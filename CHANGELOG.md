# Changelog

The format of this file is loosely based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/):

- **Added** for new features.
- **Changed** for changes in existing functionality.
- **Deprecated** for soon-to-be removed features.
- **Removed** for now removed features.
- **Fixed** for any bug fixes.
- **Security** in case of vulnerabilities.

## [Unreleased]
### Added

- Added CHANGELOG.md

## [v0.37.0] - 2018-29-03

### Fixed
- Fixed a bug during function packing that prevents the API backend to run  
  (0.36.0 was a flawed release)

## [v0.36.0] - 2018-29-03

### Added
- [getMessage] Added a `status` field to the message object
- [submitMessageforUser] Messages accept a new `time_to_live` field
- [getProfile] Added `is_webhook_enabled` to the user's profile object  
  (`true` if the user wants to receive in app notifications)

### Changed
- [getMessage] Modified values of the the notification object `status` field  
  (`SENT_TO_CHANNEL` is renamed to `SENT`)

### Fixed
- [upsertProfile] Added check of conflicts during Profile updates;  
  now returns HTTP code `429` in case of version mismatch

[getService]: https://teamdigitale.github.io/digital-citizenship/api/public.html#operation/getService
[getMessage]: https://teamdigitale.github.io/digital-citizenship/api/public.html#operation/getMessage
[getMessagesByUser]: https://teamdigitale.github.io/digital-citizenship/api/public.html#operation/getMessagesByUser
[submitMessageforUser]: https://teamdigitale.github.io/digital-citizenship/api/public.html#operation/submitMessageforUser
[getProfile]: https://teamdigitale.github.io/digital-citizenship/api/public.html#operation/getProfile
[upsertProfile]: https://teamdigitale.github.io/digital-citizenship/api/public.html#operation/upsertProfile
[getInfo]: https://teamdigitale.github.io/digital-citizenship/api/public.html#operation/getInfo

[Unreleased]: https://github.com/teamdigitale/digital-citizenship-functions/compare/v0.37.0...HEAD
[v0.37.0]: https://github.com/teamdigitale/digital-citizenship-functions/compare/v0.36.0...v0.37.0
[v0.36.0]: https://github.com/teamdigitale/digital-citizenship-functions/compare/v0.35.0...v0.36.0
