# Changelog

The format of this file is loosely based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/):

- **Added** for new features.
- **Changed** for changes in existing functionality.
- **Deprecated** for soon-to-be removed features.
- **Removed** for now removed features.
- **Fixed** for any bug fixes.
- **Security** in case of vulnerabilities.

## [Unreleased]

## [v0.46.0] - 2018-07-09

### Added
- Added a maximum to the allowed amount a service can charge to a user

### Fixed
- [submitMessageforUser] Save payment_data aside message textual content

## [v0.45.0] - 2018-07-03

### Added
- Added docs and docker-compose.yml to deploy functions locally

## [v0.44.0] - 2018-06-25

### Changed
- [getService] changed format for organization fiscal code (now is [0-9]{11})

## [v0.43.0] - 2018-06-13

### Removed
- [getProfile] Removed `accepted_service_tos_version` field (reverted changes in 0.42)

### Changed
- [submitMessageforUser] Changed: message `subject` is now mandatory

## [v0.42.0] - 2018-06-11

### Added
- [getProfile] Added `sender_allowed` to profile properties: true in case the
  calling service can send notifications to the fiscal code of the retrieved profile
- [getProfile] Added `accepted_service_tos_version`: returns the latest version
  of the Terms of Service accepted by the user (one for each service)
- [getService] Added `organization_fiscal_code` to service properties
- [submitMessageforUser] Added payment metadata into the message payload  
  (`payment.amount`, `payment.notice_number`)
- [internal] Added a function to monitor the lenght of the queues

## [v0.41.0] - 2018-06-02

### Added
- [getSenderServices] Added a new endpoint to get the list of services
  that have sent at least one message to some specific user

### Changed
- [getMessagesByUser] Return messages in inverse chronological order

## [v0.40.0] - 2018-05-10

### Added
- [getProfile] Added `blocked_inbox_or_channels` field: a blacklist to selectively
  block notifications from a specific sender service or channel

## [v0.39.0] - 2018-05-10

### Added
- [getMessage] Added `created_at` field to the returned message payload 

## [v0.38.0] - 2018-05-04

### Added
- Added CHANGELOG.md

### Fixed
- Small tweaks for the release procedure

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

[Unreleased]: https://github.com/teamdigitale/digital-citizenship-functions/compare/v0.46.0...HEAD
[v0.46.0]: https://github.com/teamdigitale/digital-citizenship-functions/compare/v0.45.0...v0.46.0
[v0.45.0]: https://github.com/teamdigitale/digital-citizenship-functions/compare/v0.44.0...v0.45.0
[v0.44.0]: https://github.com/teamdigitale/digital-citizenship-functions/compare/v0.43.0...v0.44.0
[v0.43.0]: https://github.com/teamdigitale/digital-citizenship-functions/compare/v0.42.0...v0.43.0
[v0.42.0]: https://github.com/teamdigitale/digital-citizenship-functions/compare/v0.41.0...v0.42.0
[v0.41.0]: https://github.com/teamdigitale/digital-citizenship-functions/compare/v0.40.0...v0.41.0
[v0.40.0]: https://github.com/teamdigitale/digital-citizenship-functions/compare/v0.39.0...v0.40.0
[v0.39.0]: https://github.com/teamdigitale/digital-citizenship-functions/compare/v0.38.0...v0.39.0
[v0.38.0]: https://github.com/teamdigitale/digital-citizenship-functions/compare/v0.37.0...v0.38.0
[v0.37.0]: https://github.com/teamdigitale/digital-citizenship-functions/compare/v0.36.0...v0.37.0
[v0.36.0]: https://github.com/teamdigitale/digital-citizenship-functions/compare/v0.35.0...v0.36.0
