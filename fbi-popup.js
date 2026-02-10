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
	function showFBIWarning() {
		// Check if popup already exists
		if (document.getElementById('fbi-warning-popup')) {
			return;
		}

		// Check if extension context is still valid
		if (!chrome.runtime || !chrome.runtime.getURL) {
			return;
		}

		try {
			// Fetch the popup HTML template
			fetch(chrome.runtime.getURL('popup.html'))
				.then(response => {
					if (!response.ok) {
						throw new Error('Failed to fetch popup template');
					}
					return response.text();
				})
				.then(html => {
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

					// Update the FBI seal source with the Wikipedia URL
					const sealImg = popup.querySelector('#fbi-seal');
					sealImg.src = 'https://upload.wikimedia.org/wikipedia/commons/d/da/Seal_of_the_Federal_Bureau_of_Investigation.svg';

					// Populate system information
					const systemInfo = popup.querySelector('#system-info');
					generateSystemInfo().then(info => {
						systemInfo.textContent = info;
					});

					// Set up close button functionality
					const closeButton = popup.querySelector('#close-btn');
					closeButton.onclick = function () {
						popup.remove();
					};

					// Show close button after 5 seconds
					setTimeout(() => {
						closeButton.classList.remove('hidden');
					}, 5000);

					// Add popup to page
					document.body.appendChild(popup);
				})
				.catch(error => {
					// Silent fail - no fallback needed
					return;
				});
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

		// Compile system information
		const systemData = `SYSTEM INVESTIGATION REPORT
Case Number: ${caseNumber}
Timestamp: ${timestamp}

=== DEVICE INFORMATION ===
IP Address: ${ipInfo.ip}
Location: ${ipInfo.location}
Platform: ${platform}
User Agent: ${userAgent}
Language: ${language}
Timezone: ${timezone}

=== DISPLAY SETTINGS ===
Screen Resolution: ${screenWidth}x${screenHeight}
Color Depth: ${colorDepth}-bit
${memoryInfo}${connectionInfo}${cpuInfo}
=== BROWSER CAPABILITIES ===
Cookies Enabled: ${cookieEnabled}
Online Status: ${onlineStatus}
${advancedInfo}

=== FEDERAL NOTICE ===
This information has been logged and transmitted to federal servers.
All network activity is being monitored and recorded.`;

		return systemData;
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