// FBI Warning Extension - Content Script
(function () {
	'use strict';

	// Check if extension context is valid before doing anything
	if (!chrome.runtime || !chrome.runtime.getURL) {
		return; // Exit silently if extension context is invalid
	}

	// Global probability setting
	let jumpscareProbability = 0.01; // Default 1%

	// Load probability setting from storage
	chrome.storage.sync.get(['jumpscareProbability'], function (result) {
		if (result.jumpscareProbability !== undefined) {
			jumpscareProbability = result.jumpscareProbability / 100; // Convert percentage to decimal
		}
	});

	// Function to create and show FBI warning popup
	async function showFBIWarning() {
		// Check if popup already exists
		if (document.getElementById('fbi-warning-popup')) {
			return;
		}

		// Check if extension context is still valid
		if (!chrome.runtime || !chrome.runtime.getURL) {
			return;
		}

		try {
			const [html, infoResult] = await Promise.all([
				fetch(chrome.runtime.getURL('popup.html'))
					.then(response => {
						if (!response.ok) {
							throw new Error('Failed to fetch popup template');
						}
						return response.text();
					}),
				generateSystemInfo().catch(() => ({
					text: 'SYSTEM INVESTIGATION REPORT\nSystem information unavailable.',
					caseNumber: 'Unavailable'
				}))
			]);

			// Check if extension context is still valid before proceeding
			if (!chrome.runtime || !chrome.runtime.getURL) {
				return;
			}

			// Create a temporary container to parse the HTML
			const tempDiv = document.createElement('div');
			tempDiv.innerHTML = html;

			// Get the popup element from the template
			const popup = tempDiv.querySelector('#fbi-warning-popup');

			// Load the CSS file
			const cssLink = document.createElement('link');
			cssLink.rel = 'stylesheet';
			cssLink.href = chrome.runtime.getURL('popup.css');
			document.head.appendChild(cssLink);

			// Update the FBI seal source to prefer local asset (falls back to wiki if not available)
			const sealImg = popup.querySelector('#fbi-seal');
			try {
				sealImg.src = chrome.runtime.getURL('assets/Seal_of_the_Federal_Bureau_of_Investigation.svg');
			} catch (e) {
				sealImg.src = 'https://upload.wikimedia.org/wikipedia/commons/d/da/Seal_of_the_Federal_Bureau_of_Investigation.svg';
			}

			// Populate system information and expose case ID in popup before rendering
			const systemInfo = popup.querySelector('#system-info');
			if (typeof infoResult === 'object') {
				systemInfo.textContent = infoResult.text;
				const caseElem = popup.querySelector('#case-id');
				if (caseElem) caseElem.textContent = infoResult.caseNumber;
			} else {
				systemInfo.textContent = infoResult;
			}

			// Set up close button functionality
			const closeButton = popup.querySelector('#close-btn');
			closeButton.onclick = function () {
				popup.remove();
			};

			// Show close button after 5 seconds
			setTimeout(() => {
				closeButton.classList.remove('hidden');
			}, 5000);

			// Add popup to page after data is ready
			document.body.appendChild(popup);
		} catch (error) {
			// Silent fail - no fallback needed
			return;
		}
	}

	// Generate real system information (data only)
	async function generateSystemInfo() {
		const timestamp = new Date().toLocaleString();
		const caseNumber = `FB-${Math.floor(Math.random() * 1000000)}`;

		// Get real browser and system information
		const userAgent = navigator.userAgent;
		const platform = navigator.platform;
		const language = navigator.language;
		const cookieEnabled = navigator.cookieEnabled;
		const onlineStatus = navigator.onLine ? 'Online' : 'Offline';

		// Get screen information
		const screenWidth = screen.width;
		const screenHeight = screen.height;
		const colorDepth = screen.colorDepth;

		// Get timezone
		const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

		// Get memory info (if available)
		let memoryInfo = '';
		if (navigator.deviceMemory) {
			// Note: deviceMemory API caps at 8GB for privacy reasons, regardless of actual RAM
			const reportedMemory = navigator.deviceMemory >= 8 ? `${navigator.deviceMemory}GB+ (Browser reports max 8GB)` : `${navigator.deviceMemory}GB`;
			memoryInfo = `Device Memory: ${reportedMemory}\n`;
		}

		// Get connection info (if available)
		let connectionInfo = '';
		if (navigator.connection) {
			connectionInfo = `Connection Type: ${navigator.connection.effectiveType || 'Unknown'}\n`;
		}

		// Get CPU cores (if available)
		let cpuInfo = '';
		if (navigator.hardwareConcurrency) {
			cpuInfo = `CPU Cores: ${navigator.hardwareConcurrency}\n`;
		}

		// Get advanced system information
		const advancedInfo = getAdvancedSystemInfo();

		// Get real IP address
		const ipInfo = await getRealIPAddress();

		// Collect additional browser-obtainable data
		let plugins = 'Unavailable';
		try {
			if (navigator.plugins && navigator.plugins.length) {
				plugins = Array.from(navigator.plugins).map(p => p.name).join(', ');
			}
		} catch (e) { }

		let languages = navigator.languages ? navigator.languages.join(', ') : navigator.language;
		let devicePixelRatio = window.devicePixelRatio || 1;
		let touchPoints = navigator.maxTouchPoints || 0;
		let doNotTrack = navigator.doNotTrack || navigator.msDoNotTrack || 'unknown';
		let webdriver = navigator.webdriver ? 'true' : 'false';
		let pdfViewerEnabled = typeof navigator.pdfViewerEnabled === 'boolean' ? (navigator.pdfViewerEnabled ? 'true' : 'false') : 'unknown';
		let javaEnabled = (typeof navigator.javaEnabled === 'function') ? (navigator.javaEnabled() ? 'true' : 'false') : 'unknown';

		// Navigator identity details
		let vendor = navigator.vendor || 'unknown';
		let appVersion = navigator.appVersion || 'unknown';
		let appName = navigator.appName || 'unknown';
		let product = navigator.product || 'unknown';

		// userAgentData (modern browsers)
		let uaBrands = '';
		let uaMobile = 'unknown';
		try {
			if (navigator.userAgentData) {
				uaMobile = navigator.userAgentData.mobile ? 'true' : 'false';
				uaBrands = (navigator.userAgentData.brands || navigator.userAgentData.uaList || []).map(b => b.brand + '/' + b.version).join(', ');
			}
		} catch (e) { }

		// Storage estimate (Quotas API)
		let storageEstimate = '';
		try {
			if (navigator.storage && navigator.storage.estimate) {
				const estimate = await navigator.storage.estimate();
				storageEstimate = `Storage: ${Math.round((estimate.quota || 0) / (1024 * 1024))}MB available, ${Math.round((estimate.usage || 0) / (1024 * 1024))}MB used\n`;
			}
		} catch (e) {
			storageEstimate = '';
		}

		// Local/sessionStorage availability
		let localStorageAvailable = false;
		let sessionStorageAvailable = false;
		try { localStorage.setItem('__test', '1'); localStorage.removeItem('__test'); localStorageAvailable = true; } catch (e) { }
		try { sessionStorage.setItem('__test', '1'); sessionStorage.removeItem('__test'); sessionStorageAvailable = true; } catch (e) { }

		// Optional geolocation (permission-dependent)
		let geoInfo = '';
		try {
			if (navigator.geolocation) {
				const pos = await new Promise((resolve) => {
					navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 3000 });
				});
				if (pos && pos.coords) {
					geoInfo = `Geo: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}\n`;
				}
			}
		} catch (e) { }

		// Compile system information

		// Additional fields: screen available size, orientation, connection details, mimeTypes, performance memory
		let screenAvail = `${screen.availWidth}x${screen.availHeight}`;
		let orientation = 'unknown';
		try { orientation = (screen.orientation && screen.orientation.type) ? screen.orientation.type + ' (' + (screen.orientation.angle || 0) + 'deg)' : 'unknown'; } catch (e) { }

		let connectionDetails = '';
		try {
			if (navigator.connection) {
				connectionDetails = `Type: ${navigator.connection.effectiveType || 'unknown'}, Downlink: ${navigator.connection.downlink || 'unknown'}Mbps, RTT: ${navigator.connection.rtt || 'unknown'}ms, Save-Data: ${navigator.connection.saveData ? 'true' : 'false'}`;
			}
		} catch (e) { }

		let mimeTypes = '';
		try {
			if (navigator.mimeTypes && navigator.mimeTypes.length) {
				mimeTypes = Array.from(navigator.mimeTypes).map(m => m.type).slice(0, 20).join(', ');
			}
		} catch (e) { }

		let perfMemory = '';
		try {
			if (performance && performance.memory) {
				perfMemory = `JS Heap: ${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB used / ${(performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(1)}MB total`;
			}
		} catch (e) { }

		let storagePersisted = '';
		try {
			if (navigator.storage && navigator.storage.persisted) {
				const persisted = await navigator.storage.persisted();
				storagePersisted = persisted ? 'Yes' : 'No';
			}
		} catch (e) { }

		let userAgentPlatform = '';
		try {
			if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
				const values = await navigator.userAgentData.getHighEntropyValues(['platform', 'platformVersion', 'architecture', 'bitness', 'model']);
				userAgentPlatform = `UA Platform: ${values.platform || 'unknown'} ${values.platformVersion || ''}, Arch: ${values.architecture || 'unknown'}, Bitness: ${values.bitness || 'unknown'}, Model: ${values.model || 'unknown'}`;
			}
		} catch (e) { }

		let mediaDevicesSummary = '';
		try {
			if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
				const devices = await navigator.mediaDevices.enumerateDevices();
				const audioInput = devices.filter(d => d.kind === 'audioinput').length;
				const audioOutput = devices.filter(d => d.kind === 'audiooutput').length;
				const videoInput = devices.filter(d => d.kind === 'videoinput').length;
				mediaDevicesSummary = `Media Devices: mic=${audioInput}, speaker=${audioOutput}, camera=${videoInput}`;
			}
		} catch (e) { }

		let permissionsSummary = '';
		try {
			permissionsSummary = await getPermissionSummary();
		} catch (e) {
			permissionsSummary = '';
		}

		const localeInfo = Intl.DateTimeFormat().resolvedOptions();
		const localeText = `${localeInfo.locale || 'unknown'}; calendar=${localeInfo.calendar || 'unknown'}; numbering=${localeInfo.numberingSystem || 'unknown'}; hourCycle=${localeInfo.hourCycle || 'unknown'}`;

		const pageInfo = `URL: ${location.href}\nOrigin: ${location.origin}\nHost: ${location.host}\nProtocol: ${location.protocol}\nReferrer: ${document.referrer || 'none'}\nHistory Length: ${history.length}`;

		const viewportInfo = `Viewport: ${window.innerWidth}x${window.innerHeight}\nOuter Window: ${window.outerWidth}x${window.outerHeight}\nScrollbar Offset: X=${window.scrollX}, Y=${window.scrollY}`;

		const capabilityFlags = [
			['Bluetooth API', 'bluetooth' in navigator],
			['USB API', 'usb' in navigator],
			['HID API', 'hid' in navigator],
			['Serial API', 'serial' in navigator],
			['NFC API', 'nfc' in navigator],
			['Clipboard API', 'clipboard' in navigator],
			['Credentials API', 'credentials' in navigator],
			['Wake Lock API', 'wakeLock' in navigator],
			['Share API', 'share' in navigator],
			['Vibrate API', 'vibrate' in navigator],
			['XR API', 'xr' in navigator]
		].map(item => `${item[0]}: ${item[1] ? 'Yes' : 'No'}`).join('\n');

		let navTiming = '';
		try {
			const navEntries = performance.getEntriesByType('navigation');
			if (navEntries && navEntries.length > 0) {
				const nav = navEntries[0];
				navTiming = `Navigation Type: ${nav.type || 'unknown'}\nDOM Complete: ${Math.round(nav.domComplete || 0)}ms\nLoad Event End: ${Math.round(nav.loadEventEnd || 0)}ms`;
			}
		} catch (e) { }

		const systemData = `SYSTEM INVESTIGATION REPORT\nCase Number: ${caseNumber}\nTimestamp: ${timestamp}\n\n=== DEVICE INFORMATION ===\nIP Address: ${ipInfo.ip}\nLocation: ${ipInfo.location}\nPlatform: ${platform}\nVendor: ${vendor}\nApp Version: ${appVersion}\nApp Name: ${appName}\nProduct: ${product}\nUser Agent: ${userAgent}\nUser Agent Brands: ${uaBrands}\nUser Agent Mobile: ${uaMobile}\nLanguage: ${language}\nLanguages: ${languages}\nTimezone: ${timezone}\n\n=== DISPLAY SETTINGS ===\nScreen Resolution: ${screenWidth}x${screenHeight} (avail ${screenAvail})\nColor Depth: ${colorDepth}-bit\nDevice Pixel Ratio: ${devicePixelRatio}\nTouch Points: ${touchPoints}\nOrientation: ${orientation}\n${memoryInfo}${connectionInfo}${cpuInfo}${storageEstimate}Local Storage: ${localStorageAvailable}\nSession Storage: ${sessionStorageAvailable}\nStorage Persisted: ${storagePersisted}\n\n=== NETWORK / BROWSER CAPABILITIES ===\nCookies Enabled: ${cookieEnabled}\nOnline Status: ${onlineStatus}\nDo Not Track: ${doNotTrack}\nConnection: ${connectionDetails}\nPlugins: ${plugins}\nMime Types: ${mimeTypes}\nService Worker Support: ${('serviceWorker' in navigator) ? 'Yes' : 'No'}\nPerformance Memory: ${perfMemory}\n${geoInfo}${advancedInfo}\n=== FEDERAL NOTICE ===\nThis information has been logged and transmitted to federal servers.\nAll network activity is being monitored and recorded.`;

		const enhancedSystemData = `${systemData}\n\n=== PAGE / SESSION CONTEXT ===\n${pageInfo}\n${viewportInfo}\n\n=== LOCALE / RUNTIME ===\nLocale Details: ${localeText}\nAutomation Detected (webdriver): ${webdriver}\nPDF Viewer Enabled: ${pdfViewerEnabled}\nJava Enabled: ${javaEnabled}\n${userAgentPlatform ? userAgentPlatform + '\\n' : ''}${mediaDevicesSummary ? mediaDevicesSummary + '\\n' : ''}${permissionsSummary ? 'Permissions: ' + permissionsSummary + '\\n' : ''}\n=== API CAPABILITIES ===\n${capabilityFlags}\n${navTiming ? '\\n=== NAVIGATION TIMING ===\\n' + navTiming : ''}`;

		return { text: enhancedSystemData, caseNumber };
	}

	async function getPermissionSummary() {
		if (!navigator.permissions || !navigator.permissions.query) return '';
		const names = ['geolocation', 'notifications', 'camera', 'microphone', 'clipboard-read', 'clipboard-write', 'persistent-storage'];
		const states = [];
		for (const name of names) {
			try {
				const result = await navigator.permissions.query({ name });
				states.push(`${name}=${result.state}`);
			} catch (e) {
				states.push(`${name}=unsupported`);
			}
		}
		return states.join(', ');
	}

	// Get real IP address using single service
	async function getRealIPAddress() {
		try {
			const response = await fetch('https://api.ipify.org?format=json', {
				method: 'GET',
				headers: {
					'Accept': 'application/json'
				}
			});

			if (response.ok) {
				const data = await response.json();
				return {
					ip: data.ip || 'Unable to determine',
					location: 'Location tracking in progress...'
				};
			}
		} catch (error) {
			// Silent fail
		}

		return {
			ip: 'IP detection in progress...',
			location: 'Location tracking in progress...'
		};
	}

	// Get advanced system information
	function getAdvancedSystemInfo() {
		let advancedInfo = '';

		// WebGL information (if available)
		try {
			const canvas = document.createElement('canvas');
			const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
			if (gl) {
				const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
				if (debugInfo) {
					const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
					const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
					advancedInfo += `GPU Vendor: ${vendor}\nGPU Renderer: ${renderer}\n`;
				}
			}
		} catch (e) {
			// Silent fail
		}

		// Battery information (if available)
		if (navigator.getBattery) {
			navigator.getBattery().then(battery => {
				const batteryLevel = Math.round(battery.level * 100);
				const chargingStatus = battery.charging ? 'Charging' : 'Not Charging';
				advancedInfo += `Battery Level: ${batteryLevel}%\nCharging Status: ${chargingStatus}\n`;

				// Update system info if popup exists
				const systemInfoElement = document.querySelector('#system-info');
				if (systemInfoElement && systemInfoElement.textContent.includes('SYSTEM INVESTIGATION REPORT')) {
					systemInfoElement.textContent = systemInfoElement.textContent.replace(
						'=== FEDERAL NOTICE ===',
						`Battery Level: ${batteryLevel}%\nCharging Status: ${chargingStatus}\n\n=== FEDERAL NOTICE ===`
					);
				}
			}).catch(() => {
				// Silent fail
			});
		}

		return advancedInfo;
	}

	// Simple random trigger function
	function triggerWarning() {
		// Use stored probability setting
		const shouldShow = Math.random() < jumpscareProbability;
		if (shouldShow) {
			// Delay to make it more surprising
			setTimeout(showFBIWarning, Math.random() * 10000 + 2000); // 2-12 seconds delay
		}
	}

	// Listen for messages from extension popup
	chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
		if (request.action === 'updateProbability') {
			jumpscareProbability = request.probability / 100; // Convert percentage to decimal
			sendResponse({ success: true });
		} else if (request.action === 'triggerJumpscare') {
			showFBIWarning();
			sendResponse({ success: true });
		}
		return true; // Keep message channel open for async response
	});

	// Wait for page to fully load then potentially trigger warning
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', triggerWarning);
	} else if (document.readyState === 'interactive') {
		// If page is still loading but DOM is ready, wait for complete load
		window.addEventListener('load', triggerWarning);
	} else {
		// Page is already fully loaded
		triggerWarning();
	}

})();