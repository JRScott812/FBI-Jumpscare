// Shared default settings for popup and content script
var DEFAULT_SETTINGS = {
	enabled: true,
	jumpscareProbability: 1,
	delayMinSec: 2,
	delayMaxSec: 12,
	acknowledgeLockSec: 5,
	cooldownSec: 0,
	showSystemDump: true,
	showDisclaimer: true,
	discoveryMessage: "You've been pranked! This is a joke extension, no data was sent anywhere.",
	isArmed: false,
	includeIpLookup: true,
	includeGps: true,
	verboseFingerprint: true,
	entranceAnimation: true,
	soundSting: false,
	siteMode: 'blocklist',
	domainList: 'mail.google.com\nbankofamerica.com\nchase.com\nwellsfargo.com'
};

function mergeSettings(stored) {
	var s = {};
	var key;
	for (key in DEFAULT_SETTINGS) {
		if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
			s[key] = stored && stored[key] !== undefined ? stored[key] : DEFAULT_SETTINGS[key];
		}
	}
	if (s.delayMaxSec < s.delayMinSec) {
		s.delayMaxSec = s.delayMinSec;
	}
	return s;
}

function sanitizeSettings(partial) {
	return mergeSettings(partial || {});
}

function hasLegacySettings(stored) {
	if (!stored) return false;
	var key;
	for (key in stored) {
		if (Object.prototype.hasOwnProperty.call(stored, key) &&
			!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
			return true;
		}
	}
	return false;
}
