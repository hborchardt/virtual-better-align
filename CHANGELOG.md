# Change Log

All notable changes to the "virtual-better-align" extension will be documented in this file.

## [v0.1.0]

- Implement proper arrow key cursor handling
- Add "Virtual Better Align: Toggle active" command to deactivate the functionality, possibly via a keyboard shortcut
- Don't align colons with beginning of a multiline object or array
  ```ts
  // before
  const test = {
    a:             123,
    nice:          777,
    somethingElse: {
      good: true
    }
  }
  // after
  const test = {
    a:    123,
    nice: 777,
    somethingElse: {
      good: true
    }
  }
- Better readme

## [v0.0.2]

- Fix alignment of inserted white space relative to cursor

## [v0.0.1]

- Initial release