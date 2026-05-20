// Extension Popup Script - Settings Interface
document.addEventListener('DOMContentLoaded', function () {
	const slider = document.getElementById('percentageSlider');
	const display = document.getElementById('percentageDisplay');
	const saveBtn = document.getElementById('saveBtn');
	const testBtn = document.getElementById('testBtn');
	const status = document.getElementById('status');

	// Load current settings
	chrome.storage.sync.get(['jumpscareProbability'], function (result) {
		const probability = result.jumpscareProbability || 1; // Default 1%
		slider.value = probability;
		display.textContent = probability + '%';
	});

	// Update display when slider changes
	// Update display when slider changes and auto-save (debounced)
	let saveTimeout = null;
	slider.addEventListener('input', function () {
		display.textContent = slider.value + '%';
		// debounce auto-save to avoid rapid storage writes
		if (saveTimeout) clearTimeout(saveTimeout);
		saveTimeout = setTimeout(() => {
			const probability = parseInt(slider.value);
			saveProbability(probability, false);
		}, 450);
	});

	// Reusable save function
	function saveProbability(probability, showUiStatus = true) {
		chrome.storage.sync.set({ jumpscareProbability: probability }, function () {
			if (showUiStatus) showStatus('Settings saved successfully!', 'success');

			// Notify all tabs of the setting change
			chrome.tabs.query({}, function (tabs) {
				tabs.forEach(tab => {
					try {
						chrome.tabs.sendMessage(tab.id, {
							action: 'updateProbability',
							probability: probability
						});
					} catch (e) {
						// ignore tabs without our content script
					}
				});
			});
		});
	}

	// Save settings (manual Save button)
	saveBtn.addEventListener('click', function () {
		const probability = parseInt(slider.value);
		saveProbability(probability, true);
	});

	// Test jumpscare now
	testBtn.addEventListener('click', function () {
		chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
			chrome.tabs.sendMessage(tabs[0].id, {
				action: 'triggerJumpscare'
			}, function (response) {
				if (chrome.runtime.lastError) {
					showStatus('Cannot trigger on this page', 'error');
				} else {
					showStatus('Jumpscare triggered!', 'success');
					window.close(); // Close popup after triggering
				}
			});
		});
	});

	// Show status message
	function showStatus(message, type) {
		status.textContent = message;
		status.className = `status ${type}`;
		status.classList.remove('hidden');

		setTimeout(() => {
			status.classList.add('hidden');
		}, 3000);
	}
});