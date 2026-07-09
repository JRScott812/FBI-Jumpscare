# FBI Jumpscare

A Chrome extension that randomly shows a fullscreen FBI-style warning overlay as a prank.

**This is a joke extension — no data is sent to any server except an optional IP geolocation lookup (ipapi.co) for display in the overlay text.**

## Setup (prankster)

1. Load the extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked).
2. Open the toolbar popup and configure settings across the **General**, **Timing**, **Content**, and **Advanced** tabs.
3. Write a **discovery message** in the Content tab (what the victim sees when they find the extension).
4. Click **Arm Prank** — settings are hidden on future popup opens.

## Discovery (victim)

When the prank is armed, clicking the extension icon shows your custom discovery message instead of settings.

## Prankster unlock

Triple-click the FBI seal on the discovery screen to reopen settings. Use **Disarm** to show setup on the next open without the triple-click.

## Notes

- Location is never requested via browser prompt. GPS coords appear only if the user already granted location on that site. Otherwise city/region comes from IP lookup.
- **Show prank references** (Content tab) toggles the footer disclaimer, system report note, and discovery subtext.
- **Sound sting** (Advanced tab) plays a classic PC-style beep when the overlay appears. Off by default; may require a prior click on the page due to browser autoplay rules.
- Default site **blocklist** skips common email/banking domains — edit in the Advanced tab.
- Icons and overlay are plain HTML/CSS/JS — no build step.

## Permissions

- `storage` — save settings
- `<all_urls>` — inject content script on pages
- `ipapi.co` — optional IP geolocation for the scare report
