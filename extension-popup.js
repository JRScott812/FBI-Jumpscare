// Extension Popup Script - Settings Interface
document.addEventListener('DOMContentLoaded', function () {
	var settings = mergeSettings({});
	var saveTimeout = null;
	var sealClickCount = 0;
	var sealClickTimer = null;

	var setupView = document.getElementById('setup-view');
	var discoveryView = document.getElementById('discovery-view');
	var status = document.getElementById('status');
	var armBtn = document.getElementById('armBtn');
	var disarmBtn = document.getElementById('disarmBtn');
	var discoveryMessageEl = document.getElementById('discovery-message');
	var discoverySeal = document.getElementById('discovery-seal');

	function showStatus(message, type) {
		status.textContent = message;
		status.className = 'status ' + type;
		status.classList.remove('hidden');
		setTimeout(function () {
			status.classList.add('hidden');
		}, 3000);
	}

	function showDiscovery() {
		setupView.classList.add('hidden');
		discoveryView.classList.remove('hidden');
		discoveryMessageEl.textContent = settings.discoveryMessage;
		var subtext = document.getElementById('discovery-subtext');
		if (subtext) {
			if (settings.showDisclaimer) {
				subtext.classList.remove('hidden');
			} else {
				subtext.classList.add('hidden');
			}
		}
	}

	function showSetup() {
		discoveryView.classList.add('hidden');
		setupView.classList.remove('hidden');
		updateDisarmVisibility();
	}

	function updateDisarmVisibility() {
		if (settings.isArmed) {
			disarmBtn.classList.remove('hidden');
		} else {
			disarmBtn.classList.add('hidden');
		}
	}

	function updateArmButton() {
		var msg = document.getElementById('discoveryMessageInput').value.trim();
		armBtn.disabled = !msg;
	}

	function readFormIntoSettings() {
		settings.enabled = document.getElementById('enabledToggle').checked;
		settings.jumpscareProbability = parseInt(document.getElementById('percentageSlider').value, 10);
		settings.delayMinSec = parseInt(document.getElementById('delayMinSlider').value, 10);
		settings.delayMaxSec = parseInt(document.getElementById('delayMaxSlider').value, 10);
		settings.acknowledgeLockSec = parseInt(document.getElementById('ackLockSlider').value, 10);
		settings.cooldownSec = parseInt(document.getElementById('cooldownSlider').value, 10);
		settings.showSystemDump = document.getElementById('showSystemDumpToggle').checked;
		settings.showDisclaimer = document.getElementById('showDisclaimerToggle').checked;
		settings.discoveryMessage = document.getElementById('discoveryMessageInput').value;
		settings.includeIpLookup = document.getElementById('includeIpToggle').checked;
		settings.includeGps = document.getElementById('includeGpsToggle').checked;
		settings.verboseFingerprint = document.getElementById('verboseToggle').checked;
		settings.entranceAnimation = document.getElementById('animationToggle').checked;
		settings.soundSting = document.getElementById('soundToggle').checked;
		settings.domainList = document.getElementById('domainListInput').value;

		var siteModeEl = document.querySelector('input[name="siteMode"]:checked');
		settings.siteMode = siteModeEl ? siteModeEl.value : 'blocklist';

		if (settings.delayMaxSec < settings.delayMinSec) {
			settings.delayMaxSec = settings.delayMinSec;
			document.getElementById('delayMaxSlider').value = settings.delayMaxSec;
			document.getElementById('delayMaxDisplay').textContent = settings.delayMaxSec;
		}
	}

	function applySettingsToForm() {
		document.getElementById('enabledToggle').checked = settings.enabled;
		document.getElementById('percentageSlider').value = settings.jumpscareProbability;
		document.getElementById('percentageDisplay').textContent = settings.jumpscareProbability + '%';
		document.getElementById('delayMinSlider').value = settings.delayMinSec;
		document.getElementById('delayMinDisplay').textContent = settings.delayMinSec;
		document.getElementById('delayMaxSlider').value = settings.delayMaxSec;
		document.getElementById('delayMaxDisplay').textContent = settings.delayMaxSec;
		document.getElementById('ackLockSlider').value = settings.acknowledgeLockSec;
		document.getElementById('ackLockDisplay').textContent = settings.acknowledgeLockSec;
		document.getElementById('cooldownSlider').value = settings.cooldownSec;
		document.getElementById('cooldownDisplay').textContent = settings.cooldownSec;
		document.getElementById('showSystemDumpToggle').checked = settings.showSystemDump;
		document.getElementById('showDisclaimerToggle').checked = settings.showDisclaimer;
		document.getElementById('discoveryMessageInput').value = settings.discoveryMessage;
		document.getElementById('includeIpToggle').checked = settings.includeIpLookup;
		document.getElementById('includeGpsToggle').checked = settings.includeGps;
		document.getElementById('verboseToggle').checked = settings.verboseFingerprint;
		document.getElementById('animationToggle').checked = settings.entranceAnimation;
		document.getElementById('soundToggle').checked = settings.soundSting;
		document.getElementById('domainListInput').value = settings.domainList;

		var siteRadios = document.querySelectorAll('input[name="siteMode"]');
		siteRadios.forEach(function (radio) {
			radio.checked = radio.value === settings.siteMode;
		});

		updateArmButton();
		updateDisarmVisibility();
	}

	function notifyTabs() {
		chrome.tabs.query({}, function (tabs) {
			tabs.forEach(function (tab) {
				chrome.tabs.sendMessage(tab.id, {
					action: 'updateSettings',
					settings: settings
				}, function () {
					if (chrome.runtime.lastError) { /* ignore */ }
				});
			});
		});
	}

	function saveSettings(showToast) {
		readFormIntoSettings();
		settings = sanitizeSettings(settings);
		chrome.storage.sync.set(settings, function () {
			if (showToast) showStatus('Saved', 'success');
			notifyTabs();
		});
	}

	function debouncedSave() {
		if (saveTimeout) clearTimeout(saveTimeout);
		saveTimeout = setTimeout(function () {
			saveSettings(false);
		}, 450);
	}

	// Tab switching
	document.querySelectorAll('[data-tab]').forEach(function (btn) {
		btn.addEventListener('click', function () {
			document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
			btn.classList.add('active');
			document.querySelectorAll('[data-panel]').forEach(function (p) { p.classList.add('hidden'); });
			document.getElementById(btn.dataset.tab).classList.remove('hidden');
		});
	});

	// Bind all inputs
	var inputs = document.querySelectorAll('#setup-view input, #setup-view textarea');
	inputs.forEach(function (el) {
		el.addEventListener('input', debouncedSave);
		el.addEventListener('change', debouncedSave);
	});

	document.getElementById('percentageSlider').addEventListener('input', function () {
		document.getElementById('percentageDisplay').textContent = this.value + '%';
	});
	document.getElementById('delayMinSlider').addEventListener('input', function () {
		document.getElementById('delayMinDisplay').textContent = this.value;
	});
	document.getElementById('delayMaxSlider').addEventListener('input', function () {
		document.getElementById('delayMaxDisplay').textContent = this.value;
	});
	document.getElementById('ackLockSlider').addEventListener('input', function () {
		document.getElementById('ackLockDisplay').textContent = this.value;
	});
	document.getElementById('cooldownSlider').addEventListener('input', function () {
		document.getElementById('cooldownDisplay').textContent = this.value;
	});
	document.getElementById('discoveryMessageInput').addEventListener('input', updateArmButton);

	document.querySelectorAll('.preset-btn').forEach(function (btn) {
		btn.addEventListener('click', function () {
			var val = parseInt(btn.dataset.preset, 10);
			document.getElementById('percentageSlider').value = val;
			document.getElementById('percentageDisplay').textContent = val + '%';
			debouncedSave();
		});
	});

	document.getElementById('testBtn').addEventListener('click', function () {
		saveSettings(false);
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			if (!tabs[0]) return;
			chrome.tabs.sendMessage(tabs[0].id, { action: 'triggerJumpscare' }, function () {
				if (chrome.runtime.lastError) {
					showStatus('Cannot trigger on this page', 'error');
				} else {
					showStatus('Jumpscare triggered!', 'success');
					setTimeout(function () { window.close(); }, 1000);
				}
			});
		});
	});

	document.getElementById('previewDiscoveryBtn').addEventListener('click', function () {
		readFormIntoSettings();
		discoveryMessageEl.textContent = settings.discoveryMessage;
		showDiscovery();
	});

	document.getElementById('discoveryOkBtn').addEventListener('click', function () {
		if (settings.isArmed) {
			window.close();
		} else {
			showSetup();
		}
	});

	discoverySeal.addEventListener('click', function () {
		sealClickCount++;
		if (sealClickTimer) clearTimeout(sealClickTimer);
		sealClickTimer = setTimeout(function () { sealClickCount = 0; }, 600);
		if (sealClickCount >= 3) {
			sealClickCount = 0;
			showSetup();
		}
	});

	document.getElementById('armBtn').addEventListener('click', function () {
		readFormIntoSettings();
		if (!settings.discoveryMessage.trim()) return;
		settings.isArmed = true;
		settings = sanitizeSettings(settings);
		chrome.storage.sync.set(settings, function () {
			notifyTabs();
			showStatus('Prank armed, settings hidden', 'success');
			setTimeout(function () { window.close(); }, 800);
		});
	});

	document.getElementById('disarmBtn').addEventListener('click', function () {
		settings.isArmed = false;
		settings = sanitizeSettings(settings);
		chrome.storage.sync.set(settings, function () {
			updateDisarmVisibility();
			showStatus('Disarmed, setup visible on next open', 'success');
		});
	});

	document.getElementById('resetBtn').addEventListener('click', function () {
		settings = sanitizeSettings({});
		settings.isArmed = false;
		applySettingsToForm();
		chrome.storage.sync.set(settings, function () {
			notifyTabs();
			showStatus('Reset to defaults', 'success');
		});
	});

	chrome.storage.sync.get(null, function (result) {
		settings = sanitizeSettings(result);
		if (hasLegacySettings(result)) {
			chrome.storage.sync.set(settings);
		}
		applySettingsToForm();
		if (settings.isArmed) {
			showDiscovery();
		} else {
			showSetup();
		}
	});
});
