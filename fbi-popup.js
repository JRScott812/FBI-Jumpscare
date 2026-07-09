// FBI Warning Extension - Content Script
(function () {
	'use strict';

	if (!chrome.runtime || !chrome.runtime.getURL) {
		return;
	}

	var settings = mergeSettings({});
	var popupHtmlCache = null;
	var COOLDOWN_KEY = 'fbi_jumpscare_last';
	var audioCtx = null;
	var audioUnlockSetup = false;
	var stingPlayed = false;
	var BEEP_GAIN = 3.5;
	var BEEP_FREQ = 880;
	var BEEP_PATTERN = [[0, 0.09], [0.14, 0.09], [0.28, 0.12]];

	function getAudioContext() {
		if (!audioCtx) {
			audioCtx = new (window.AudioContext || window.webkitAudioContext)();
		}
		return audioCtx;
	}

	function unlockAudio() {
		var ctx = getAudioContext();
		if (ctx.state === 'running') return Promise.resolve(ctx);
		return ctx.resume().catch(function () { return null; });
	}

	function setupAudioUnlock() {
		if (audioUnlockSetup) return;
		audioUnlockSetup = true;

		var events = ['pointerdown', 'keydown', 'touchstart', 'click'];
		function onGesture() {
			unlockAudio();
		}

		events.forEach(function (ev) {
			document.addEventListener(ev, onGesture, true);
			window.addEventListener(ev, onGesture, true);
		});
	}

	setupAudioUnlock();

	function schedulePcBeep(ctx) {
		var now = ctx.currentTime;
		var master = ctx.createGain();
		master.gain.value = BEEP_GAIN;
		master.connect(ctx.destination);

		for (var i = 0; i < BEEP_PATTERN.length; i++) {
			var start = BEEP_PATTERN[i][0];
			var len = BEEP_PATTERN[i][1];
			var osc = ctx.createOscillator();
			var gate = ctx.createGain();
			osc.type = 'square';
			osc.frequency.value = BEEP_FREQ;
			osc.connect(gate);
			gate.connect(master);
			gate.gain.setValueAtTime(1, now + start);
			gate.gain.setValueAtTime(0, now + start + len);
			osc.start(now + start);
			osc.stop(now + start + len + 0.01);
		}
	}

	function playPcBeep(fallbackTarget) {
		if (!settings.soundSting || stingPlayed) return;

		function fire() {
			var ctx = getAudioContext();
			if (!ctx || ctx.state !== 'running') return false;
			schedulePcBeep(ctx);
			stingPlayed = true;
			return true;
		}

		if (fire()) return;

		unlockAudio().then(function () {
			if (stingPlayed || fire()) return;
			if (!fallbackTarget) return;
			function onInteract() {
				fallbackTarget.removeEventListener('pointerdown', onInteract, true);
				fire();
			}
			fallbackTarget.addEventListener('pointerdown', onInteract, true);
		});
	}

	function warmAudioForSting() {
		if (!settings.soundSting) return;
		unlockAudio();
	}

	chrome.storage.sync.get(null, function (result) {
		settings = sanitizeSettings(result);
		if (document.readyState === 'loading') {
			document.addEventListener('DOMContentLoaded', triggerWarning);
		} else if (document.readyState === 'interactive') {
			window.addEventListener('load', triggerWarning);
		} else {
			triggerWarning();
		}
	});

	function isRestrictedPage() {
		var p = location.protocol;
		return p === 'chrome:' || p === 'chrome-extension:' || p === 'about:' || p === 'edge:' || p === 'moz-extension:';
	}

	function isSiteAllowed() {
		var host = location.hostname;
		var domains = settings.domainList.split('\n').map(function (d) { return d.trim(); }).filter(Boolean);
		if (settings.siteMode === 'all') return true;
		var match = domains.some(function (d) {
			return host === d || host.endsWith('.' + d);
		});
		return settings.siteMode === 'allowlist' ? match : !match;
	}

	function isCooldownElapsed() {
		if (!settings.cooldownSec) return true;
		try {
			var last = parseInt(sessionStorage.getItem(COOLDOWN_KEY) || '0', 10);
			return Date.now() - last >= settings.cooldownSec * 1000;
		} catch (e) {
			return true;
		}
	}

	function markCooldown() {
		try {
			sessionStorage.setItem(COOLDOWN_KEY, String(Date.now()));
		} catch (e) { }
	}

	function dismissOverlay(popup, cssLink, prevOverflow) {
		if (popup && popup.parentNode) popup.remove();
		if (cssLink && cssLink.parentNode) cssLink.remove();
		document.body.style.overflow = prevOverflow || '';
	}

	function showFBIWarning(infoResult) {
		if (document.getElementById('fbi-warning-popup')) return;
		if (!chrome.runtime || !chrome.runtime.getURL) return;

		var fallback = {
			text: 'SYSTEM INVESTIGATION REPORT\nSystem information unavailable.',
			caseNumber: 'Unavailable'
		};
		var info = infoResult || fallback;
		stingPlayed = false;

		function render(html) {
			var tempDiv = document.createElement('div');
			tempDiv.innerHTML = html;
			var popup = tempDiv.querySelector('#fbi-warning-popup');
			if (!popup) return;

			var cssLink = document.createElement('link');
			cssLink.rel = 'stylesheet';
			cssLink.href = chrome.runtime.getURL('popup.css');
			document.head.appendChild(cssLink);

			var sealImg = popup.querySelector('#fbi-seal');
			if (sealImg) {
				sealImg.src = chrome.runtime.getURL('assets/Seal_of_the_Federal_Bureau_of_Investigation.svg');
			}

			var systemInfo = popup.querySelector('#system-info');
			if (systemInfo) {
				if (settings.showSystemDump) {
					systemInfo.textContent = info.text;
					systemInfo.classList.remove('hidden');
				} else {
					systemInfo.classList.add('hidden');
				}
			}

			var caseElem = popup.querySelector('#case-id');
			if (caseElem) caseElem.textContent = info.caseNumber;

			var disclaimerEl = popup.querySelector('#prank-disclaimer');
			if (disclaimerEl) {
				if (settings.showDisclaimer) {
					disclaimerEl.classList.remove('hidden');
				} else {
					disclaimerEl.classList.add('hidden');
				}
			}

			if (settings.entranceAnimation && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
				popup.classList.add('entrance-flash');
			}

			var prevOverflow = document.body.style.overflow;
			document.body.style.overflow = 'hidden';

			var closeButton = popup.querySelector('#close-btn');
			var lockSec = settings.acknowledgeLockSec || 0;
			var countdownId = null;

			function doDismiss() {
				if (countdownId) clearInterval(countdownId);
				dismissOverlay(popup, cssLink, prevOverflow);
			}

			if (closeButton) {
				closeButton.onclick = doDismiss;
				closeButton.classList.remove('hidden');
				closeButton.disabled = true;

				if (lockSec > 0) {
					var remaining = lockSec;
					closeButton.textContent = 'ACKNOWLEDGE WARNING (' + remaining + ')';
					countdownId = setInterval(function () {
						remaining--;
						if (remaining <= 0) {
							clearInterval(countdownId);
							closeButton.disabled = false;
							closeButton.textContent = 'ACKNOWLEDGE WARNING';
						} else {
							closeButton.textContent = 'ACKNOWLEDGE WARNING (' + remaining + ')';
						}
					}, 1000);
				} else {
					closeButton.disabled = false;
					closeButton.textContent = 'ACKNOWLEDGE WARNING';
				}
			}

			popup.setAttribute('role', 'dialog');
			popup.setAttribute('aria-modal', 'true');
			document.body.appendChild(popup);
			playPcBeep(popup);
			markCooldown();
		}

		if (popupHtmlCache) {
			render(popupHtmlCache);
			return;
		}

		fetch(chrome.runtime.getURL('popup.html'))
			.then(function (response) {
				if (!response.ok) throw new Error('Failed to fetch popup template');
				return response.text();
			})
			.then(function (html) {
				popupHtmlCache = html;
				render(html);
			})
			.catch(function () { });
	}

	async function getGeoInfo() {
		if (!settings.includeGps) return '';
		var geoInfo = '';
		try {
			if (navigator.permissions && navigator.permissions.query) {
				var status = await navigator.permissions.query({ name: 'geolocation' });
				if (status.state === 'granted' && navigator.geolocation) {
					var pos = await new Promise(function (resolve) {
						navigator.geolocation.getCurrentPosition(resolve, function () { resolve(null); }, { timeout: 2000, maximumAge: 600000 });
					});
					if (pos && pos.coords) {
						geoInfo = 'GPS: ' + pos.coords.latitude.toFixed(4) + ', ' + pos.coords.longitude.toFixed(4) + '\n';
					}
				}
			}
		} catch (e) { }
		return geoInfo;
	}

	async function getIpInfo() {
		if (!settings.includeIpLookup) {
			return { ip: 'Lookup disabled', location: 'Unknown' };
		}
		try {
			var response = await fetch('https://ipapi.co/json/', {
				method: 'GET',
				headers: { Accept: 'application/json' }
			});
			if (response.ok) {
				var data = await response.json();
				var parts = [data.city, data.region, data.country_name].filter(Boolean);
				return {
					ip: data.ip || 'Unable to determine',
					location: parts.length ? parts.join(', ') + ' (approx.)' : 'Unknown'
				};
			}
		} catch (e) { }
		return { ip: 'Unable to determine', location: 'Unknown' };
	}

	async function getPermissionSummary() {
		if (!navigator.permissions || !navigator.permissions.query) return '';
		var names = ['geolocation', 'notifications', 'camera', 'microphone', 'clipboard-read', 'clipboard-write', 'persistent-storage'];
		var results = await Promise.all(names.map(function (name) {
			return navigator.permissions.query({ name: name }).then(function (result) {
				return name + '=' + result.state;
			}).catch(function () {
				return name + '=unsupported';
			});
		}));
		return results.join(', ');
	}

	async function getAdvancedSystemInfo() {
		var advancedInfo = '';
		try {
			var canvas = document.createElement('canvas');
			var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
			if (gl) {
				var debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
				if (debugInfo) {
					advancedInfo += 'GPU Vendor: ' + gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) + '\n';
					advancedInfo += 'GPU Renderer: ' + gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) + '\n';
				}
			}
		} catch (e) { }

		if (navigator.getBattery) {
			try {
				var battery = await navigator.getBattery();
				var batteryLevel = Math.round(battery.level * 100);
				var chargingStatus = battery.charging ? 'Charging' : 'Not Charging';
				advancedInfo += 'Battery Level: ' + batteryLevel + '%\n';
				advancedInfo += 'Charging Status: ' + chargingStatus + '\n';
			} catch (e) { }
		}
		return advancedInfo;
	}

	async function generateSystemInfo() {
		var timestamp = new Date().toLocaleString();
		var caseNumber = 'FB-' + Math.floor(Math.random() * 1000000);
		var ipInfo = await getIpInfo();
		var geoInfo = await getGeoInfo();

		var userAgent = navigator.userAgent;
		var platform = navigator.platform;
		var language = navigator.language;
		var timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		var screenWidth = screen.width;
		var screenHeight = screen.height;
		var colorDepth = screen.colorDepth;
		var screenAvail = screen.availWidth + 'x' + screen.availHeight;

		var memoryInfo = '';
		if (navigator.deviceMemory) {
			var reportedMemory = navigator.deviceMemory >= 8
				? navigator.deviceMemory + 'GB+ (Browser reports max 8GB)'
				: navigator.deviceMemory + 'GB';
			memoryInfo = 'Device Memory: ' + reportedMemory + '\n';
		}

		var connectionInfo = '';
		var connectionDetails = '';
		if (navigator.connection) {
			connectionInfo = 'Connection Type: ' + (navigator.connection.effectiveType || 'Unknown') + '\n';
			connectionDetails = 'Type: ' + (navigator.connection.effectiveType || 'unknown') +
				', Downlink: ' + (navigator.connection.downlink || 'unknown') + 'Mbps' +
				', RTT: ' + (navigator.connection.rtt || 'unknown') + 'ms';
		}

		var cpuInfo = navigator.hardwareConcurrency ? 'CPU Cores: ' + navigator.hardwareConcurrency + '\n' : '';
		var advancedInfo = settings.verboseFingerprint ? await getAdvancedSystemInfo() : '';

		var federalNotice = settings.showDisclaimer
			? '\n=== FEDERAL NOTICE ===\n[PRANK SIMULATION — no data transmitted]\nAll network activity is being monitored and recorded.'
			: '\n=== FEDERAL NOTICE ===\nAll network activity is being monitored and recorded.';

		var systemData = 'SYSTEM INVESTIGATION REPORT\nCase Number: ' + caseNumber +
			'\nTimestamp: ' + timestamp +
			'\n\n=== DEVICE INFORMATION ===\nIP Address: ' + ipInfo.ip +
			'\nLocation: ' + ipInfo.location +
			'\nPlatform: ' + platform +
			'\nUser Agent: ' + userAgent +
			'\nLanguage: ' + language +
			'\nTimezone: ' + timezone +
			'\n\n=== DISPLAY SETTINGS ===\nScreen Resolution: ' + screenWidth + 'x' + screenHeight + ' (avail ' + screenAvail + ')' +
			'\nColor Depth: ' + colorDepth + '-bit\n' + memoryInfo + connectionInfo + cpuInfo + geoInfo + advancedInfo +
			federalNotice;

		if (!settings.verboseFingerprint) {
			return { text: systemData, caseNumber: caseNumber };
		}

		var plugins = 'Unavailable';
		try {
			if (navigator.plugins && navigator.plugins.length) {
				plugins = Array.from(navigator.plugins).map(function (p) { return p.name; }).join(', ');
			}
		} catch (e) { }

		var permissionsSummary = '';
		try {
			permissionsSummary = await getPermissionSummary();
		} catch (e) { }

		var pageInfo = 'URL: ' + location.href + '\nHost: ' + location.host;
		var viewportInfo = 'Viewport: ' + window.innerWidth + 'x' + window.innerHeight;

		var enhanced = systemData + '\n\n=== PAGE / SESSION CONTEXT ===\n' + pageInfo + '\n' + viewportInfo +
			'\n\n=== NETWORK / BROWSER ===\nConnection: ' + connectionDetails +
			'\nPlugins: ' + plugins +
			(permissionsSummary ? '\nPermissions: ' + permissionsSummary : '');

		return { text: enhanced, caseNumber: caseNumber };
	}

	function getRandomDelay() {
		var min = settings.delayMinSec * 1000;
		var max = settings.delayMaxSec * 1000;
		if (max <= min) return min;
		return min + Math.random() * (max - min);
	}

	function triggerWarning() {
		if (isRestrictedPage()) return;
		if (!settings.enabled) return;
		if (!isSiteAllowed()) return;
		if (!isCooldownElapsed()) return;

		var probability = settings.jumpscareProbability / 100;
		if (Math.random() >= probability) return;

		warmAudioForSting();

		var dataPromise = generateSystemInfo().catch(function () {
			return {
				text: 'SYSTEM INVESTIGATION REPORT\nSystem information unavailable.',
				caseNumber: 'Unavailable'
			};
		});

		setTimeout(function () {
			dataPromise.then(function (info) {
				showFBIWarning(info);
			});
		}, getRandomDelay());
	}

	function triggerManual() {
		warmAudioForSting();
		generateSystemInfo().catch(function () {
			return {
				text: 'SYSTEM INVESTIGATION REPORT\nSystem information unavailable.',
				caseNumber: 'Unavailable'
			};
		}).then(function (info) {
			showFBIWarning(info);
		});
	}

	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		if (request.action === 'updateSettings') {
			settings = sanitizeSettings(request.settings);
			sendResponse({ success: true });
		} else if (request.action === 'triggerJumpscare') {
			triggerManual();
			sendResponse({ success: true });
		}
		return true;
	});

	chrome.storage.onChanged.addListener(function (changes, area) {
		if (area !== 'sync') return;
		var updated = {};
		var key;
		for (key in changes) {
			if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
				updated[key] = changes[key].newValue;
			}
		}
		if (Object.keys(updated).length) {
			settings = sanitizeSettings(Object.assign({}, settings, updated));
		}
	});

})();
