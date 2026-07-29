# Page

> **Source:** [playwright.dev/docs/api/class-page](https://playwright.dev/docs/api/class-page)

---

Page provides methods to interact with a single tab in a Browser, or an [extension background page](https://developer.chrome.com/extensions/background_pages) in Chromium. One Browser instance might have multiple Page instances.

This example creates a page, navigates it to a URL, and then saves a screenshot:

```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.

(async () => {
  const browser = await webkit.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.screenshot({ path: 'screenshot.png' });
  await browser.close();
})();
```

The Page class emits various events (described below) which can be handled using any of Node's native [`EventEmitter`](https://nodejs.org/api/events.html#events_class_eventemitter) methods, such as `on`, `once` or `removeListener`.

This example logs a message for a single page `load` event:

```js
page.once('load', () => console.log('Page loaded!'));
```

To unsubscribe from events use the `removeListener` method:

```js
function logRequest(interceptedRequest) {
  console.log('A request was made:', interceptedRequest.url());
}
page.on('request', logRequest);
// Sometime later...
page.removeListener('request', logRequest);
```


---

## Methods

### addInitScript {/* #page-add-init-script */}



Adds a script which would be evaluated in one of the following scenarios:
* Whenever the page is navigated.
* Whenever the child frame is attached or navigated. In this case, the script is evaluated in the context of the newly attached frame.

The script is evaluated after the document was created but before any of its scripts were run. This is useful to amend the JavaScript environment, e.g. to seed `Math.random`.

**Usage**

An example of overriding `Math.random` before the page loads:

```js
// preload.js
Math.random = () => 42;
```

```js
// In your playwright script, assuming the preload.js file is in same directory
await page.addInitScript({ path: './preload.js' });
```

```js
await page.addInitScript(mock => {
  window.mock = mock;
}, mock);
```

:::note
The order of evaluation of multiple scripts installed via [browserContext.addInitScript()](/api/class-browsercontext.mdx#browser-context-add-init-script) and [page.addInitScript()](/api/class-page.mdx#page-add-init-script) is not defined.
:::

**Arguments**
- `script` function | string | Object
  - `path` string *(optional)*
    
    Path to the JavaScript file. If `path` is a relative path, then it is resolved relative to the current working directory. Optional.
  - `content` string *(optional)*
    
    Raw script content. Optional.
  
  Script to be evaluated in the page.
- `arg` Serializable *(optional)*
  
  Optional argument to pass to [script](/api/class-page.mdx#page-add-init-script-option-script) (only supported when passing a function).
- `options` Object *(optional)*
  - `exposeFunctions` boolean *(optional)* 
    
    When set to `true`, functions passed inside [arg](/api/class-page.mdx#page-add-init-script-option-arg) are exposed in the page and can be called from the init script. Calling one returns a Promise of its result. Under the hood, each function is exposed via [page.exposeFunction()](/api/class-page.mdx#page-expose-function), so it is technically accessible from all frames and worlds of the page. Unlike functions passed to [page.evaluate()](/api/class-page.mdx#page-evaluate), functions passed to an init script are exposed in every new document, so they survive navigations. Defaults to `false`, in which case functions are not serializable and are silently dropped.

**Returns**
- Promise<Disposable>

---

### addLocatorHandler {/* #page-add-locator-handler */}



When testing a web page, sometimes unexpected overlays like a "Sign up" dialog appear and block actions you want to automate, e.g. clicking a button. These overlays don't always show up in the same way or at the same time, making them tricky to handle in automated tests.

This method lets you set up a special function, called a handler, that activates when it detects that overlay is visible. The handler's job is to remove the overlay, allowing your test to continue as if the overlay wasn't there.

Things to keep in mind:
* When an overlay is shown predictably, we recommend explicitly waiting for it in your test and dismissing it as a part of your normal test flow, instead of using [page.addLocatorHandler()](/api/class-page.mdx#page-add-locator-handler).
* Playwright checks for the overlay every time before executing or retrying an action that requires an [actionability check](../actionability.mdx), or before performing an auto-waiting assertion check. When overlay is visible, Playwright calls the handler first, and then proceeds with the action/assertion. Note that the handler is only called when you perform an action/assertion - if the overlay becomes visible but you don't perform any actions, the handler will not be triggered.
* After executing the handler, Playwright will ensure that overlay that triggered the handler is not visible anymore. You can opt-out of this behavior with [noWaitAfter](/api/class-page.mdx#page-add-locator-handler-option-no-wait-after).
* The execution time of the handler counts towards the timeout of the action/assertion that executed the handler. If your handler takes too long, it might cause timeouts.
* You can register multiple handlers. However, only a single handler will be running at a time. Make sure the actions within a handler don't depend on another handler.

:::warning

Running the handler will alter your page state mid-test. For example it will change the currently focused element and move the mouse. Make sure that actions that run after the handler are self-contained and do not rely on the focus and mouse state being unchanged.

For example, consider a test that calls [locator.focus()](/api/class-locator.mdx#locator-focus) followed by [keyboard.press()](/api/class-keyboard.mdx#keyboard-press). If your handler clicks a button between these two actions, the focused element most likely will be wrong, and key press will happen on the unexpected element. Use [locator.press()](/api/class-locator.mdx#locator-press) instead to avoid this problem.

Another example is a series of mouse actions, where [mouse.move()](/api/class-mouse.mdx#mouse-move) is followed by [mouse.down()](/api/class-mouse.mdx#mouse-down). Again, when the handler runs between these two actions, the mouse position will be wrong during the mouse down. Prefer self-contained actions like [locator.click()](/api/class-locator.mdx#locator-click) that do not rely on the state being unchanged by a handler.
:::

**Usage**

An example that closes a "Sign up to the newsletter" dialog when it appears:

```js
// Setup the handler.
await page.addLocatorHandler(page.getByText('Sign up to the newsletter'), async () => {
  await page.getByRole('button', { name: 'No thanks' }).click();
});

// Write the test as usual.
await page.goto('https://example.com');
await page.getByRole('button', { name: 'Start here' }).click();
```

An example that skips the "Confirm your security details" page when it is shown:

```js
// Setup the handler.
await page.addLocatorHandler(page.getByText('Confirm your security details'), async () => {
  await page.getByRole('button', { name: 'Remind me later' }).click();
});

// Write the test as usual.
await page.goto('https://example.com');
await page.getByRole('button', { name: 'Start here' }).click();
```

An example with a custom callback on every actionability check. It uses a `<body>` locator that is always visible, so the handler is called before every actionability check. It is important to specify [noWaitAfter](/api/class-page.mdx#page-add-locator-handler-option-no-wait-after), because the handler does not hide the `<body>` element.

```js
// Setup the handler.
await page.addLocatorHandler(page.locator('body'), async () => {
  await page.evaluate(() => window.removeObstructionsForTestIfNeeded());
}, { noWaitAfter: true });

// Write the test as usual.
await page.goto('https://example.com');
await page.getByRole('button', { name: 'Start here' }).click();
```

Handler takes the original locator as an argument. You can also automatically remove the handler after a number of invocations by setting [times](/api/class-page.mdx#page-add-locator-handler-option-times):

```js
await page.addLocatorHandler(page.getByLabel('Close'), async locator => {
  await locator.click();
}, { times: 1 });
```

**Arguments**
- `locator` Locator
  
  Locator that triggers the handler.
- `handler` function\(Locator\):Promise<Object>
  
  Function that should be run once [locator](/api/class-page.mdx#page-add-locator-handler-option-locator) appears. This function should get rid of the element that blocks actions like click.
- `options` Object *(optional)*
  - `noWaitAfter` boolean *(optional)* 
    
    By default, after calling the handler Playwright will wait until the overlay becomes hidden, and only then Playwright will continue with the action/assertion that triggered the handler. This option allows to opt-out of this behavior, so that overlay can stay visible after the handler has run.
  - `times` number *(optional)* 
    
    Specifies the maximum number of times this handler should be called. Unlimited by default.

**Returns**
- Promise<void>

---

### addScriptTag {/* #page-add-script-tag */}



Adds a `<script>` tag into the page with the desired url or content. Returns the added tag when the script's onload fires or when the script content was injected into frame.

**Usage**

```js
await page.addScriptTag();
await page.addScriptTag(options);
```

**Arguments**
- `options` Object *(optional)*
  - `content` string *(optional)*
    
    Raw JavaScript content to be injected into frame.
  - `path` string *(optional)*
    
    Path to the JavaScript file to be injected into frame. If `path` is a relative path, then it is resolved relative to the current working directory.
  - `type` string *(optional)*
    
    Script type. Use 'module' in order to load a JavaScript ES6 module. See [script](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script) for more details.
  - `url` string *(optional)*
    
    URL of a script to be added.

**Returns**
- Promise<ElementHandle>

---

### addStyleTag {/* #page-add-style-tag */}



Adds a `<link rel="stylesheet">` tag into the page with the desired url or a `<style type="text/css">` tag with the content. Returns the added tag when the stylesheet's onload fires or when the CSS content was injected into frame.

**Usage**

```js
await page.addStyleTag();
await page.addStyleTag(options);
```

**Arguments**
- `options` Object *(optional)*
  - `content` string *(optional)*
    
    Raw CSS content to be injected into frame.
  - `path` string *(optional)*
    
    Path to the CSS file to be injected into frame. If `path` is a relative path, then it is resolved relative to the current working directory.
  - `url` string *(optional)*
    
    URL of the `<link>` tag.

**Returns**
- Promise<ElementHandle>

---

### ariaSnapshot {/* #page-aria-snapshot */}



Captures the aria snapshot of the page. Read more about [aria snapshots](../aria-snapshots.mdx).

**Usage**

```js
await page.ariaSnapshot();
await page.ariaSnapshot(options);
```

**Arguments**
- `options` Object *(optional)*
  - `boxes` boolean *(optional)* 
    
    When `true`, appends each element's bounding box as `box=x,y,width,height` to the snapshot. Coordinates are relative to the viewport, in CSS pixels, as returned by [`Element.getBoundingClientRect()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect). Defaults to `false`.
  - `depth` number *(optional)*
    
    When specified, limits the depth of the snapshot.
  - `mode` "ai" | "default" *(optional)*
    
    When set to `"ai"`, returns a snapshot optimized for AI consumption: including element references like `ref=e2` and snapshots of `<iframe>`s. Defaults to `"default"`.
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Promise<string>

---

### bringToFront {/* #page-bring-to-front */}



Brings page to front (activates tab).

**Usage**

```js
await page.bringToFront();
```

**Returns**
- Promise<void>

---

### cancelPickLocator {/* #page-cancel-pick-locator */}



Cancels an ongoing [page.pickLocator()](/api/class-page.mdx#page-pick-locator) call by deactivating pick locator mode. If no pick locator mode is active, this method is a no-op.

**Usage**

```js
await page.cancelPickLocator();
```

**Returns**
- Promise<void>

---

### clearConsoleMessages {/* #page-clear-console-messages */}



Clears all stored console messages from this page. Subsequent calls to [page.consoleMessages()](/api/class-page.mdx#page-console-messages) will only return messages logged after the clear.

**Usage**

```js
await page.clearConsoleMessages();
```

**Returns**
- Promise<void>

---

### clearPageErrors {/* #page-clear-page-errors */}



Clears all stored page errors from this page. Subsequent calls to [page.pageErrors()](/api/class-page.mdx#page-page-errors) will only return errors thrown after the clear.

**Usage**

```js
await page.clearPageErrors();
```

**Returns**
- Promise<void>

---

### close {/* #page-close */}



If [runBeforeUnload](/api/class-page.mdx#page-close-option-run-before-unload) is `false`, does not run any unload handlers and waits for the page to be closed. If [runBeforeUnload](/api/class-page.mdx#page-close-option-run-before-unload) is `true` the method will run unload handlers, but will **not** wait for the page to close.

By default, `page.close()` **does not** run `beforeunload` handlers.

:::note

if [runBeforeUnload](/api/class-page.mdx#page-close-option-run-before-unload) is passed as true, a `beforeunload` dialog might be summoned and should be handled manually via [page.on('dialog')](/api/class-page.mdx#page-event-dialog) event.
:::

**Usage**

```js
await page.close();
await page.close(options);
```

**Arguments**
- `options` Object *(optional)*
  - `reason` string *(optional)* 
    
    The reason to be reported to the operations interrupted by the page closure.
  - `runBeforeUnload` boolean *(optional)*
    
    Defaults to `false`. Whether to run the [before unload](https://developer.mozilla.org/en-US/docs/Web/Events/beforeunload) page handlers.

**Returns**
- Promise<void>

---

### consoleMessages {/* #page-console-messages */}



Returns up to (currently) 200 last console messages from this page. See [page.on('console')](/api/class-page.mdx#page-event-console) for more details.

**Usage**

```js
await page.consoleMessages();
await page.consoleMessages(options);
```

**Arguments**
- `options` Object *(optional)*
  - `filter` "all" | "since-navigation" *(optional)* 
    
    Controls which messages are returned:

**Returns**
- Promise<Array<ConsoleMessage>>

---

### content {/* #page-content */}



Gets the full HTML contents of the page, including the doctype.

**Usage**

```js
await page.content();
```

**Returns**
- Promise<string>

---

### context {/* #page-context */}



Get the browser context that the page belongs to.

**Usage**

```js
page.context();
```

**Returns**
- BrowserContext

---

### dragAndDrop {/* #page-drag-and-drop */}



This method drags the source element to the target element. It will first move to the source element, perform a `mousedown`, then move to the target element and perform a `mouseup`.

**Usage**

```js
await page.dragAndDrop('#source', '#target');
// or specify exact positions relative to the top-left corners of the elements:
await page.dragAndDrop('#source', '#target', {
  sourcePosition: { x: 34, y: 7 },
  targetPosition: { x: 10, y: 20 },
});
```

**Arguments**
- `source` string
  
  A selector to search for an element to drag. If there are multiple elements satisfying the selector, the first will be used.
- `target` string
  
  A selector to search for an element to drop onto. If there are multiple elements satisfying the selector, the first will be used.
- `options` Object *(optional)*
  - `force` boolean *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `noWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `scroll` "auto" | "none" *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `sourcePosition` Object *(optional)* 
    - `x` number
      
      
    - `y` number
      
      
    Clicks on the source element at this point relative to the top-left corner of the element's padding box. If not specified, some visible point of the element is used.
  - `steps` number *(optional)* 
    
    Defaults to 1. Sends `n` interpolated `mousemove` events to represent travel between the `mousedown` and `mouseup` of the drag. When set to 1, emits a single `mousemove` event at the destination location.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `targetPosition` Object *(optional)* 
    - `x` number
      
      
    - `y` number
      
      
    Drops on the target element at this point relative to the top-left corner of the element's padding box. If not specified, some visible point of the element is used.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `trial` boolean *(optional)*
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it.

**Returns**
- Promise<void>

---

### emulateMedia {/* #page-emulate-media */}



This method changes the `CSS media type` through the `media` argument, and/or the `'prefers-colors-scheme'` media feature, using the `colorScheme` argument.

**Usage**

```js
await page.evaluate(() => matchMedia('screen').matches);
// → true
await page.evaluate(() => matchMedia('print').matches);
// → false

await page.emulateMedia({ media: 'print' });
await page.evaluate(() => matchMedia('screen').matches);
// → false
await page.evaluate(() => matchMedia('print').matches);
// → true

await page.emulateMedia({});
await page.evaluate(() => matchMedia('screen').matches);
// → true
await page.evaluate(() => matchMedia('print').matches);
// → false
```

```js
await page.emulateMedia({ colorScheme: 'dark' });
await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
// → true
await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches);
// → false
```

**Arguments**
- `options` Object *(optional)*
  - `colorScheme` null | "light" | "dark" | "no-preference" *(optional)* 
    
    Emulates [prefers-colors-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme) media feature, supported values are `'light'` and `'dark'`. Passing `null` disables color scheme emulation. `'no-preference'` is deprecated.
  - `contrast` null | "no-preference" | "more" *(optional)* 
    
    Emulates `'prefers-contrast'` media feature, supported values are `'no-preference'`, `'more'`. Passing `null` disables contrast emulation.
  - `forcedColors` null | "active" | "none" *(optional)* 
    
    Emulates `'forced-colors'` media feature, supported values are `'active'` and `'none'`. Passing `null` disables forced colors emulation.
  - `media` null | "screen" | "print" *(optional)* 
    
    Changes the CSS media type of the page. The only allowed values are `'screen'`, `'print'` and `null`. Passing `null` disables CSS media emulation.
  - `reducedMotion` null | "reduce" | "no-preference" *(optional)* 
    
    Emulates `'prefers-reduced-motion'` media feature, supported values are `'reduce'`, `'no-preference'`. Passing `null` disables reduced motion emulation.

**Returns**
- Promise<void>

---

### evaluate {/* #page-evaluate */}



Returns the value of the [pageFunction](/api/class-page.mdx#page-evaluate-option-expression) invocation.

If the function passed to the [page.evaluate()](/api/class-page.mdx#page-evaluate) returns a Promise, then [page.evaluate()](/api/class-page.mdx#page-evaluate) would wait for the promise to resolve and return its value.

If the function passed to the [page.evaluate()](/api/class-page.mdx#page-evaluate) returns a non-Serializable value, then [page.evaluate()](/api/class-page.mdx#page-evaluate) resolves to `undefined`. Playwright also supports transferring some additional values that are not serializable by `JSON`: `-0`, `NaN`, `Infinity`, `-Infinity`.

**Usage**

Passing argument to [pageFunction](/api/class-page.mdx#page-evaluate-option-expression):

```js
const result = await page.evaluate((x, y) => {
  return Promise.resolve(x * y);
}, 7, 8);
console.log(result); // prints "56"
```

A string can also be passed in instead of a function:

```js
console.log(await page.evaluate('1 + 2')); // prints "3"
const x = 10;
console.log(await page.evaluate(`1 + ${x}`)); // prints "11"
```

ElementHandle instances can be passed as an argument to the [page.evaluate()](/api/class-page.mdx#page-evaluate):

```js
const bodyHandle = await page.evaluateHandle('document.body');
const html = await page.evaluate<string, HTMLElement>((body, suffix) =>
  body.innerHTML + suffix, bodyHandle, 'hello'
);
await bodyHandle.dispose();
```

**Arguments**
- `pageFunction` function | string
  
  Function to be evaluated in the page context.
- `arg` EvaluationArgument *(optional)*
  
  Optional argument to pass to [pageFunction](/api/class-page.mdx#page-evaluate-option-expression).
- `options` Object *(optional)*
  - `exposeFunctions` boolean *(optional)* 
    
    When set to `true`, functions passed inside [arg](/api/class-page.mdx#page-evaluate-option-arg) are exposed in the page and can be called from the page function. Calling one returns a Promise of its result. Under the hood, each function is exposed via [page.exposeFunction()](/api/class-page.mdx#page-expose-function), so it is technically accessible from all frames and worlds of the page. Exposed functions are cleared upon the top-level navigation. Defaults to `false`, in which case functions are not serializable and passing one throws an error.

**Returns**
- Promise<Serializable>

---

### evaluateHandle {/* #page-evaluate-handle */}



Returns the value of the [pageFunction](/api/class-page.mdx#page-evaluate-handle-option-expression) invocation as a JSHandle.

The only difference between [page.evaluate()](/api/class-page.mdx#page-evaluate) and [page.evaluateHandle()](/api/class-page.mdx#page-evaluate-handle) is that [page.evaluateHandle()](/api/class-page.mdx#page-evaluate-handle) returns JSHandle.

If the function passed to the [page.evaluateHandle()](/api/class-page.mdx#page-evaluate-handle) returns a Promise, then [page.evaluateHandle()](/api/class-page.mdx#page-evaluate-handle) would wait for the promise to resolve and return its value.

**Usage**

```js
// Handle for the window object.
const aWindowHandle = await page.evaluateHandle(() => Promise.resolve(window));
```

A string can also be passed in instead of a function:

```js
const aHandle = await page.evaluateHandle('document'); // Handle for the 'document'
```

JSHandle instances can be passed as an argument to the [page.evaluateHandle()](/api/class-page.mdx#page-evaluate-handle):

```js
const aHandle = await page.evaluateHandle(() => document.body);
const resultHandle = await page.evaluateHandle(body => body.innerHTML, aHandle);
console.log(await resultHandle.jsonValue());
await resultHandle.dispose();
```

**Arguments**
- `pageFunction` function | string
  
  Function to be evaluated in the page context.
- `arg` EvaluationArgument *(optional)*
  
  Optional argument to pass to [pageFunction](/api/class-page.mdx#page-evaluate-handle-option-expression).
- `options` Object *(optional)*
  - `exposeFunctions` boolean *(optional)* 
    
    When set to `true`, functions passed inside [arg](/api/class-page.mdx#page-evaluate-handle-option-arg) are exposed in the page and can be called from the page function. Calling one returns a Promise of its result. Under the hood, each function is exposed via [page.exposeFunction()](/api/class-page.mdx#page-expose-function), so it is technically accessible from all frames and worlds of the page. Exposed functions are cleared upon the top-level navigation. Defaults to `false`, in which case functions are not serializable and passing one throws an error.

**Returns**
- Promise<JSHandle>

---

### exposeBinding {/* #page-expose-binding */}



The method adds a function called [name](/api/class-page.mdx#page-expose-binding-option-name) on the `window` object of every frame in this page. When called, the function executes [callback](/api/class-page.mdx#page-expose-binding-option-callback) and returns a Promise which resolves to the return value of [callback](/api/class-page.mdx#page-expose-binding-option-callback). If the [callback](/api/class-page.mdx#page-expose-binding-option-callback) returns a Promise, it will be awaited.

The first argument of the [callback](/api/class-page.mdx#page-expose-binding-option-callback) function contains information about the caller: `{ browserContext: BrowserContext, page: Page, frame: Frame }`.

See [browserContext.exposeBinding()](/api/class-browsercontext.mdx#browser-context-expose-binding) for the context-wide version.

:::note

Functions installed via [page.exposeBinding()](/api/class-page.mdx#page-expose-binding) survive navigations.
:::

**Usage**

An example of exposing page URL to all frames in a page:

```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.

(async () => {
  const browser = await webkit.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.exposeBinding('pageURL', ({ page }) => page.url());
  await page.setContent(`
    <script>
      async function onClick() {
        document.querySelector('div').textContent = await window.pageURL();
      }
    </script>
    <button onclick="onClick()">Click me</button>
    <div></div>
  `);
  await page.click('button');
})();
```

**Arguments**
- `name` string
  
  Name of the function on the window object.
- `callback` function
  
  Callback function that will be called in the Playwright's context.

**Returns**
- Promise<Disposable>

---

### exposeFunction {/* #page-expose-function */}



The method adds a function called [name](/api/class-page.mdx#page-expose-function-option-name) on the `window` object of every frame in the page. When called, the function executes [callback](/api/class-page.mdx#page-expose-function-option-callback) and returns a Promise which resolves to the return value of [callback](/api/class-page.mdx#page-expose-function-option-callback).

If the [callback](/api/class-page.mdx#page-expose-function-option-callback) returns a Promise, it will be awaited.

See [browserContext.exposeFunction()](/api/class-browsercontext.mdx#browser-context-expose-function) for context-wide exposed function.

:::note

Functions installed via [page.exposeFunction()](/api/class-page.mdx#page-expose-function) survive navigations.
:::

**Usage**

An example of adding a `sha256` function to the page:

```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.
const crypto = require('crypto');

(async () => {
  const browser = await webkit.launch({ headless: false });
  const page = await browser.newPage();
  await page.exposeFunction('sha256', text =>
    crypto.createHash('sha256').update(text).digest('hex'),
  );
  await page.setContent(`
    <script>
      async function onClick() {
        document.querySelector('div').textContent = await window.sha256('PLAYWRIGHT');
      }
    </script>
    <button onclick="onClick()">Click me</button>
    <div></div>
  `);
  await page.click('button');
})();
```

**Arguments**
- `name` string
  
  Name of the function on the window object
- `callback` function
  
  Callback function which will be called in Playwright's context.

**Returns**
- Promise<Disposable>

---

### frame {/* #page-frame */}



Returns frame matching the specified criteria. Either `name` or `url` must be specified.

**Usage**

```js
const frame = page.frame('frame-name');
```

```js
const frame = page.frame({ url: /.*domain.*/ });
```

**Arguments**
- `frameSelector` string | Object
  - `name` string *(optional)*
    
    Frame name specified in the `iframe`'s `name` attribute. Optional.
  - `url` string | RegExp | URLPattern | function\(URL\):boolean *(optional)*
    
    A glob pattern, regex pattern, URL pattern, or predicate receiving frame's `url` as a URL object. Optional.
  
  Frame name or other frame lookup options.

**Returns**
- null | Frame

---

### frameLocator {/* #page-frame-locator */}



When working with iframes, you can create a frame locator that will enter the iframe and allow selecting elements in that iframe.

**Usage**

Following snippet locates element with text "Submit" in the iframe with id `my-frame`, like `<iframe id="my-frame">`:

```js
const locator = page.frameLocator('#my-iframe').getByText('Submit');
await locator.click();
```

**Arguments**
- `selector` string
  
  A selector to use when resolving DOM element.

**Returns**
- FrameLocator

---

### frames {/* #page-frames */}



An array of all frames attached to the page.

**Usage**

```js
page.frames();
```

**Returns**
- Array<Frame>

---

### getByAltText {/* #page-get-by-alt-text */}



Allows locating elements by their alt text.

**Usage**

For example, this method will find the image by alt text "Playwright logo":

```html
<img alt='Playwright logo'>
```

```js
await page.getByAltText('Playwright logo').click();
```

**Arguments**
- `text` string | RegExp
  
  Text to locate the element for.
- `options` Object *(optional)*
  - `exact` boolean *(optional)*
    
    Whether to find an exact match: case-sensitive and whole-string. Default to false. Ignored when locating by a regular expression. Note that exact match still trims whitespace.

**Returns**
- Locator

---

### getByLabel {/* #page-get-by-label */}



Allows locating input elements by the text of the associated `<label>` or `aria-labelledby` element, or by the `aria-label` attribute.

**Usage**

For example, this method will find inputs by label "Username" and "Password" in the following DOM:

```html
<input aria-label="Username">
<label for="password-input">Password:</label>
<input id="password-input">
```

```js
await page.getByLabel('Username').fill('john');
await page.getByLabel('Password').fill('secret');
```

**Arguments**
- `text` string | RegExp
  
  Text to locate the element for.
- `options` Object *(optional)*
  - `exact` boolean *(optional)*
    
    Whether to find an exact match: case-sensitive and whole-string. Default to false. Ignored when locating by a regular expression. Note that exact match still trims whitespace.

**Returns**
- Locator

---

### getByPlaceholder {/* #page-get-by-placeholder */}



Allows locating input elements by the placeholder text.

**Usage**

For example, consider the following DOM structure.

```html
<input type="email" placeholder="name@example.com" />
```

You can fill the input after locating it by the placeholder text:

```js
await page
    .getByPlaceholder('name@example.com')
    .fill('playwright@microsoft.com');
```

**Arguments**
- `text` string | RegExp
  
  Text to locate the element for.
- `options` Object *(optional)*
  - `exact` boolean *(optional)*
    
    Whether to find an exact match: case-sensitive and whole-string. Default to false. Ignored when locating by a regular expression. Note that exact match still trims whitespace.

**Returns**
- Locator

---

### getByRole {/* #page-get-by-role */}



Allows locating elements by their [ARIA role](https://www.w3.org/TR/wai-aria-1.2/#roles), [ARIA attributes](https://www.w3.org/TR/wai-aria-1.2/#aria-attributes) and [accessible name](https://w3c.github.io/accname/#dfn-accessible-name).

**Usage**

Consider the following DOM structure.

```html
<h3>Sign up</h3>
<label>
  <input type="checkbox" /> Subscribe
</label>
<br/>
<button>Submit</button>
```

You can locate each element by its implicit role:

```js
await expect(page.getByRole('heading', { name: 'Sign up' })).toBeVisible();

await page.getByRole('checkbox', { name: 'Subscribe' }).check();

await page.getByRole('button', { name: /submit/i }).click();
```

**Arguments**
- `role` "alert" | "alertdialog" | "application" | "article" | "banner" | "blockquote" | "button" | "caption" | "cell" | "checkbox" | "code" | "columnheader" | "combobox" | "complementary" | "contentinfo" | "definition" | "deletion" | "dialog" | "directory" | "document" | "emphasis" | "feed" | "figure" | "form" | "generic" | "grid" | "gridcell" | "group" | "heading" | "img" | "insertion" | "link" | "list" | "listbox" | "listitem" | "log" | "main" | "marquee" | "math" | "meter" | "menu" | "menubar" | "menuitem" | "menuitemcheckbox" | "menuitemradio" | "navigation" | "none" | "note" | "option" | "paragraph" | "presentation" | "progressbar" | "radio" | "radiogroup" | "region" | "row" | "rowgroup" | "rowheader" | "scrollbar" | "search" | "searchbox" | "separator" | "slider" | "spinbutton" | "status" | "strong" | "subscript" | "superscript" | "switch" | "tab" | "table" | "tablist" | "tabpanel" | "term" | "textbox" | "time" | "timer" | "toolbar" | "tooltip" | "tree" | "treegrid" | "treeitem"
  
  Required aria role.
- `options` Object *(optional)*
  - `checked` boolean *(optional)*
    
    An attribute that is usually set by `aria-checked` or native `<input type=checkbox>` controls.
    
    Learn more about [`aria-checked`](https://www.w3.org/TR/wai-aria-1.2/#aria-checked).
  - `description` string | RegExp *(optional)* 
    
    Option to match the [accessible description](https://w3c.github.io/accname/#dfn-accessible-description). By default, matching is case-insensitive and searches for a substring, use [exact](/api/class-page.mdx#page-get-by-role-option-exact) to control this behavior.
    
    Learn more about [accessible description](https://w3c.github.io/accname/#dfn-accessible-description).
  - `disabled` boolean *(optional)*
    
    An attribute that is usually set by `aria-disabled` or `disabled`.
    
    :::note
    
    Unlike most other attributes, `disabled` is inherited through the DOM hierarchy. Learn more about [`aria-disabled`](https://www.w3.org/TR/wai-aria-1.2/#aria-disabled).
    :::
    
  - `exact` boolean *(optional)* 
    
    Whether [name](/api/class-page.mdx#page-get-by-role-option-name) and [description](/api/class-page.mdx#page-get-by-role-option-description) are matched exactly: case-sensitive and whole-string. Defaults to false. Ignored when the value is a regular expression. Note that exact match still trims whitespace.
  - `expanded` boolean *(optional)*
    
    An attribute that is usually set by `aria-expanded`.
    
    Learn more about [`aria-expanded`](https://www.w3.org/TR/wai-aria-1.2/#aria-expanded).
  - `includeHidden` boolean *(optional)*
    
    Option that controls whether hidden elements are matched. By default, only non-hidden elements, as [defined by ARIA](https://www.w3.org/TR/wai-aria-1.2/#tree_exclusion), are matched by role selector.
    
    Learn more about [`aria-hidden`](https://www.w3.org/TR/wai-aria-1.2/#aria-hidden).
  - `level` number *(optional)*
    
    A number attribute that is usually present for roles `heading`, `listitem`, `row`, `treeitem`, with default values for `<h1>-<h6>` elements.
    
    Learn more about [`aria-level`](https://www.w3.org/TR/wai-aria-1.2/#aria-level).
  - `name` string | RegExp *(optional)*
    
    Option to match the [accessible name](https://w3c.github.io/accname/#dfn-accessible-name). By default, matching is case-insensitive and searches for a substring, use [exact](/api/class-page.mdx#page-get-by-role-option-exact) to control this behavior.
    
    Learn more about [accessible name](https://w3c.github.io/accname/#dfn-accessible-name).
  - `pressed` boolean *(optional)*
    
    An attribute that is usually set by `aria-pressed`.
    
    Learn more about [`aria-pressed`](https://www.w3.org/TR/wai-aria-1.2/#aria-pressed).
  - `selected` boolean *(optional)*
    
    An attribute that is usually set by `aria-selected`.
    
    Learn more about [`aria-selected`](https://www.w3.org/TR/wai-aria-1.2/#aria-selected).

**Returns**
- Locator

**Details**

Role selector **does not replace** accessibility audits and conformance tests, but rather gives early feedback about the ARIA guidelines.

Many html elements have an implicitly [defined role](https://w3c.github.io/html-aam/#html-element-role-mappings) that is recognized by the role selector. You can find all the [supported roles here](https://www.w3.org/TR/wai-aria-1.2/#role_definitions). ARIA guidelines **do not recommend** duplicating implicit roles and attributes by setting `role` and/or `aria-*` attributes to default values.

---

### getByTestId {/* #page-get-by-test-id */}



Locate element by the test id.

**Usage**

Consider the following DOM structure.

```html
<button data-testid="directions">Itinéraire</button>
```

You can locate the element by its test id:

```js
await page.getByTestId('directions').click();
```

**Arguments**
- `testId` string | RegExp
  
  Id to locate the element by.

**Returns**
- Locator

**Details**

By default, the `data-testid` attribute is used as a test id. Use [selectors.setTestIdAttribute()](/api/class-selectors.mdx#selectors-set-test-id-attribute) to configure a different test id attribute if necessary.

```js
// Set custom test id attribute from @playwright/test config:
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    testIdAttribute: 'data-pw'
  },
});
```

---

### getByText {/* #page-get-by-text */}



Allows locating elements that contain given text.

See also [locator.filter()](/api/class-locator.mdx#locator-filter) that allows to match by another criteria, like an accessible role, and then filter by the text content.

**Usage**

Consider the following DOM structure:

```html
<div>Hello <span>world</span></div>
<div>Hello</div>
```

You can locate by text substring, exact string, or a regular expression:

```js
// Matches <span>
page.getByText('world');

// Matches first <div>
page.getByText('Hello world');

// Matches second <div>
page.getByText('Hello', { exact: true });

// Matches both <div>s
page.getByText(/Hello/);

// Matches second <div>
page.getByText(/^hello$/i);
```

**Arguments**
- `text` string | RegExp
  
  Text to locate the element for.
- `options` Object *(optional)*
  - `exact` boolean *(optional)*
    
    Whether to find an exact match: case-sensitive and whole-string. Default to false. Ignored when locating by a regular expression. Note that exact match still trims whitespace.

**Returns**
- Locator

**Details**

Matching by text always normalizes whitespace, even with exact match. For example, it turns multiple spaces into one, turns line breaks into spaces and ignores leading and trailing whitespace.

Input elements of the type `button` and `submit` are matched by their `value` instead of the text content. For example, locating by text `"Log in"` matches `<input type=button value="Log in">`.

---

### getByTitle {/* #page-get-by-title */}



Allows locating elements by their title attribute.

**Usage**

Consider the following DOM structure.

```html
<span title='Issues count'>25 issues</span>
```

You can check the issues count after locating it by the title text:

```js
await expect(page.getByTitle('Issues count')).toHaveText('25 issues');
```

**Arguments**
- `text` string | RegExp
  
  Text to locate the element for.
- `options` Object *(optional)*
  - `exact` boolean *(optional)*
    
    Whether to find an exact match: case-sensitive and whole-string. Default to false. Ignored when locating by a regular expression. Note that exact match still trims whitespace.

**Returns**
- Locator

---

### goBack {/* #page-go-back */}



Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. If cannot go back, returns `null`.

Navigate to the previous page in history.

:::warning

**Testing Back/Forward Cache (BFCache) is not supported.**  By default, Playwright disables the Back/Forward Cache across all browsers. Even if explicitly enabled, Playwright's internal state relies on network-level navigation events. Because BFCache restores unfreeze the DOM without firing these events, using `page.goBack()` or `page.goForward()` to trigger a BFCache restore will result in timeouts and a desynchronized `Page` state.
:::

**Usage**

```js
await page.goBack();
await page.goBack(options);
```

**Arguments**
- `options` Object *(optional)*
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `timeout` number *(optional)*
    
    Maximum operation time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `navigationTimeout` option in the config, or by using the [browserContext.setDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [page.setDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `waitUntil` "load" | "domcontentloaded" | "networkidle" | "commit" *(optional)*
    
    When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
    * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- Promise<null | Response>

---

### goForward {/* #page-go-forward */}



Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. If cannot go forward, returns `null`.

Navigate to the next page in history.

:::warning

**Testing Back/Forward Cache (BFCache) is not supported.**  By default, Playwright disables the Back/Forward Cache across all browsers. Even if explicitly enabled, Playwright's internal state relies on network-level navigation events. Because BFCache restores unfreeze the DOM without firing these events, using `page.goBack()` or `page.goForward()` to trigger a BFCache restore will result in timeouts and a desynchronized `Page` state.
:::

**Usage**

```js
await page.goForward();
await page.goForward(options);
```

**Arguments**
- `options` Object *(optional)*
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `timeout` number *(optional)*
    
    Maximum operation time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `navigationTimeout` option in the config, or by using the [browserContext.setDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [page.setDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `waitUntil` "load" | "domcontentloaded" | "networkidle" | "commit" *(optional)*
    
    When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
    * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- Promise<null | Response>

---

### goto {/* #page-goto */}



Returns the main resource response. In case of multiple redirects, the navigation will resolve with the first non-redirect response.

The method will throw an error if:
* there's an SSL error (e.g. in case of self-signed certificates).
* target URL is invalid.
* the [timeout](/api/class-page.mdx#page-goto-option-timeout) is exceeded during navigation.
* the remote server does not respond or is unreachable.
* the main resource failed to load.

The method will not throw an error when any valid HTTP status code is returned by the remote server, including 404 "Not Found" and 500 "Internal Server Error".  The status code for such responses can be retrieved by calling [response.status()](/api/class-response.mdx#response-status).

:::note

The method either throws an error or returns a main resource response. The only exceptions are navigation to `about:blank` or navigation to the same URL with a different hash, which would succeed and return `null`.
:::

:::note
Headless mode doesn't support navigation to a PDF document. See the [upstream issue](https://bugs.chromium.org/p/chromium/issues/detail?id=761295).
:::

**Usage**

```js
await page.goto(url);
await page.goto(url, options);
```

**Arguments**
- `url` string
  
  URL to navigate page to. The url should include scheme, e.g. `https://`. When a [baseURL](/api/class-browser.mdx#browser-new-context-option-base-url) via the context options was provided and the passed URL is a path, it gets merged via the [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor.
- `options` Object *(optional)*
  - `referer` string *(optional)*
    
    Referer header value. If provided it will take preference over the referer header value set by [page.setExtraHTTPHeaders()](/api/class-page.mdx#page-set-extra-http-headers).
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `timeout` number *(optional)*
    
    Maximum operation time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `navigationTimeout` option in the config, or by using the [browserContext.setDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [page.setDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `waitUntil` "load" | "domcontentloaded" | "networkidle" | "commit" *(optional)*
    
    When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
    * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- Promise<null | Response>

---

### hideHighlight {/* #page-hide-highlight */}



Hide all locator highlight overlays previously added by [locator.highlight()](/api/class-locator.mdx#locator-highlight) on this page.

**Usage**

```js
await page.hideHighlight();
```

**Returns**
- Promise<void>

---

### isClosed {/* #page-is-closed */}



Indicates that the page has been closed.

**Usage**

```js
page.isClosed();
```

**Returns**
- boolean

---

### locator {/* #page-locator */}



The method returns an element locator that can be used to perform actions on this page / frame. Locator is resolved to the element immediately before performing an action, so a series of actions on the same locator can in fact be performed on different DOM elements. That would happen if the DOM structure between those actions has changed.

[Learn more about locators](../locators.mdx).

**Usage**

```js
page.locator(selector);
page.locator(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to use when resolving DOM element.
- `options` Object *(optional)*
  - `has` Locator *(optional)*
    
    Narrows down the results of the method to those which contain elements matching this relative locator. For example, `article` that has `text=Playwright` matches `<article><div>Playwright</div></article>`.
    
    Inner locator **must be relative** to the outer locator and is queried starting with the outer locator match, not the document root. For example, you can find `content` that has `div` in `<article><content><div>Playwright</div></content></article>`. However, looking for `content` that has `article div` will fail, because the inner locator must be relative and should not use any elements outside the `content`.
    
    Note that outer and inner locators must belong to the same frame. Inner locator must not contain FrameLocators.
  - `hasNot` Locator *(optional)* 
    
    Matches elements that do not contain an element that matches an inner locator. Inner locator is queried against the outer one. For example, `article` that does not have `div` matches `<article><span>Playwright</span></article>`.
    
    Note that outer and inner locators must belong to the same frame. Inner locator must not contain FrameLocators.
  - `hasNotText` string | RegExp *(optional)* 
    
    Matches elements that do not contain specified text somewhere inside, possibly in a child or a descendant element. When passed a string, matching is case-insensitive and searches for a substring.
  - `hasText` string | RegExp *(optional)*
    
    Matches elements containing specified text somewhere inside, possibly in a child or a descendant element. When passed a string, matching is case-insensitive and searches for a substring. For example, `"Playwright"` matches `<article><div>Playwright</div></article>`.

**Returns**
- Locator

---

### mainFrame {/* #page-main-frame */}



The page's main frame. Page is guaranteed to have a main frame which persists during navigations.

**Usage**

```js
page.mainFrame();
```

**Returns**
- Frame

---

### opener {/* #page-opener */}



Returns the opener for popup pages and `null` for others. If the opener has been closed already the returns `null`.

**Usage**

```js
await page.opener();
```

**Returns**
- Promise<null | Page>

---

### pageErrors {/* #page-page-errors */}



Returns up to (currently) 200 last page errors from this page. See [page.on('pageerror')](/api/class-page.mdx#page-event-page-error) for more details.

**Usage**

```js
await page.pageErrors();
await page.pageErrors(options);
```

**Arguments**
- `options` Object *(optional)*
  - `filter` "all" | "since-navigation" *(optional)* 
    
    Controls which errors are returned:

**Returns**
- Promise<Array<Error>>

---

### pause {/* #page-pause */}



Pauses script execution. Playwright will stop executing the script and wait for the user to either press the 'Resume' button in the page overlay or to call `playwright.resume()` in the DevTools console.

User can inspect selectors or perform manual steps while paused. Resume will continue running the original script from the place it was paused.

:::note

This method requires Playwright to be started in a headed mode, with a falsy [headless](/api/class-browsertype.mdx#browser-type-launch-option-headless) option.
:::

**Usage**

```js
await page.pause();
```

**Returns**
- Promise<void>

---

### pdf {/* #page-pdf */}



Returns the PDF buffer.

`page.pdf()` generates a pdf of the page with `print` css media. To generate a pdf with `screen` media, call [page.emulateMedia()](/api/class-page.mdx#page-emulate-media) before calling `page.pdf()`:

:::note

By default, `page.pdf()` generates a pdf with modified colors for printing. Use the [`-webkit-print-color-adjust`](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-print-color-adjust) property to force rendering of exact colors.
:::

**Usage**

```js
// Generates a PDF with 'screen' media type.
await page.emulateMedia({ media: 'screen' });
await page.pdf({ path: 'page.pdf' });
```

The [width](/api/class-page.mdx#page-pdf-option-width), [height](/api/class-page.mdx#page-pdf-option-height), and [margin](/api/class-page.mdx#page-pdf-option-margin) options accept values labeled with units. Unlabeled values are treated as pixels.

A few examples:
* `page.pdf({width: 100})` - prints with width set to 100 pixels
* `page.pdf({width: '100px'})` - prints with width set to 100 pixels
* `page.pdf({width: '10cm'})` - prints with width set to 10 centimeters.

All possible units are:
* `px` - pixel
* `in` - inch
* `cm` - centimeter
* `mm` - millimeter

The [format](/api/class-page.mdx#page-pdf-option-format) options are:
* `Letter`: 8.5in x 11in
* `Legal`: 8.5in x 14in
* `Tabloid`: 11in x 17in
* `Ledger`: 17in x 11in
* `A0`: 33.1in x 46.8in
* `A1`: 23.4in x 33.1in
* `A2`: 16.54in x 23.4in
* `A3`: 11.7in x 16.54in
* `A4`: 8.27in x 11.7in
* `A5`: 5.83in x 8.27in
* `A6`: 4.13in x 5.83in

:::note

[headerTemplate](/api/class-page.mdx#page-pdf-option-header-template) and [footerTemplate](/api/class-page.mdx#page-pdf-option-footer-template) markup have the following limitations: > 1. Script tags inside templates are not evaluated. > 2. Page styles are not visible inside templates.
:::

**Arguments**
- `options` Object *(optional)*
  - `displayHeaderFooter` boolean *(optional)*
    
    Display header and footer. Defaults to `false`.
  - `footerTemplate` string *(optional)*
    
    HTML template for the print footer. Should use the same format as the [headerTemplate](/api/class-page.mdx#page-pdf-option-header-template).
  - `format` string *(optional)*
    
    Paper format. If set, takes priority over [width](/api/class-page.mdx#page-pdf-option-width) or [height](/api/class-page.mdx#page-pdf-option-height) options. Defaults to 'Letter'.
  - `headerTemplate` string *(optional)*
    
    HTML template for the print header. Should be valid HTML markup with following classes used to inject printing values into them:
    * `'date'` formatted print date
    * `'title'` document title
    * `'url'` document location
    * `'pageNumber'` current page number
    * `'totalPages'` total pages in the document
  - `height` string | number *(optional)*
    
    Paper height, accepts values labeled with units.
  - `landscape` boolean *(optional)*
    
    Paper orientation. Defaults to `false`.
  - `margin` Object *(optional)*
    - `top` string | number *(optional)*
      
      Top margin, accepts values labeled with units. Defaults to `0`.
    - `right` string | number *(optional)*
      
      Right margin, accepts values labeled with units. Defaults to `0`.
    - `bottom` string | number *(optional)*
      
      Bottom margin, accepts values labeled with units. Defaults to `0`.
    - `left` string | number *(optional)*
      
      Left margin, accepts values labeled with units. Defaults to `0`.
    
    Paper margins, defaults to none.
  - `outline` boolean *(optional)* 
    
    Whether or not to embed the document outline into the PDF. Defaults to `false`.
  - `pageRanges` string *(optional)*
    
    Paper ranges to print, e.g., '1-5, 8, 11-13'. Defaults to the empty string, which means print all pages.
  - `path` string *(optional)*
    
    The file path to save the PDF to. If [path](/api/class-page.mdx#page-pdf-option-path) is a relative path, then it is resolved relative to the current working directory. If no path is provided, the PDF won't be saved to the disk.
  - `preferCSSPageSize` boolean *(optional)*
    
    Give any CSS `@page` size declared in the page priority over what is declared in [width](/api/class-page.mdx#page-pdf-option-width) and [height](/api/class-page.mdx#page-pdf-option-height) or [format](/api/class-page.mdx#page-pdf-option-format) options. Defaults to `false`, which will scale the content to fit the paper size.
  - `printBackground` boolean *(optional)*
    
    Print background graphics. Defaults to `false`.
  - `scale` number *(optional)*
    
    Scale of the webpage rendering. Defaults to `1`. Scale amount must be between 0.1 and 2.
  - `tagged` boolean *(optional)* 
    
    Whether or not to generate tagged (accessible) PDF. Defaults to `false`.
  - `width` string | number *(optional)*
    
    Paper width, accepts values labeled with units.

**Returns**
- Promise<Buffer>

---

### pickLocator {/* #page-pick-locator */}



Enters pick locator mode where hovering over page elements highlights them and shows the corresponding locator. Once the user clicks an element, the mode is deactivated and the Locator for the picked element is returned.

**Usage**

```js
const locator = await page.pickLocator();
console.log(locator);
```

**Returns**
- Promise<Locator>

---

### reload {/* #page-reload */}



This method reloads the current page, in the same way as if the user had triggered a browser refresh. Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect.

**Usage**

```js
await page.reload();
await page.reload(options);
```

**Arguments**
- `options` Object *(optional)*
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `timeout` number *(optional)*
    
    Maximum operation time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `navigationTimeout` option in the config, or by using the [browserContext.setDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [page.setDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `waitUntil` "load" | "domcontentloaded" | "networkidle" | "commit" *(optional)*
    
    When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
    * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- Promise<null | Response>

---

### removeAllListeners {/* #page-remove-all-listeners */}



Removes all the listeners of the given type (or all registered listeners if no type given). Allows to wait for async listeners to complete or to ignore subsequent errors from these listeners.

**Usage**

```js
page.on('request', async request => {
  const response = await request.response();
  const body = await response.body();
  console.log(body.byteLength);
});
await page.goto('https://playwright.dev', { waitUntil: 'domcontentloaded' });
// Waits for all the reported 'request' events to resolve.
await page.removeAllListeners('request', { behavior: 'wait' });
```

**Arguments**
- `type` string *(optional)*
- `options` Object *(optional)*
  - `behavior` "wait" | "ignoreErrors" | "default" *(optional)*
    
    Specifies whether to wait for already running listeners and what to do if they throw errors:
    * `'default'` - do not wait for current listener calls (if any) to finish, if the listener throws, it may result in unhandled error
    * `'wait'` - wait for current listener calls (if any) to finish
    * `'ignoreErrors'` - do not wait for current listener calls (if any) to finish, all errors thrown by the listeners after removal are silently caught

**Returns**
- Promise<void>

---

### removeLocatorHandler {/* #page-remove-locator-handler */}



Removes all locator handlers added by [page.addLocatorHandler()](/api/class-page.mdx#page-add-locator-handler) for a specific locator.

**Usage**

```js
await page.removeLocatorHandler(locator);
```

**Arguments**
- `locator` Locator
  
  Locator passed to [page.addLocatorHandler()](/api/class-page.mdx#page-add-locator-handler).

**Returns**
- Promise<void>

---

### requestGC {/* #page-request-gc */}



Request the page to perform garbage collection. Note that there is no guarantee that all unreachable objects will be collected.

This is useful to help detect memory leaks. For example, if your page has a large object `'suspect'` that might be leaked, you can check that it does not leak by using a [`WeakRef`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef).

```js
// 1. In your page, save a WeakRef for the "suspect".
await page.evaluate(() => globalThis.suspectWeakRef = new WeakRef(suspect));
// 2. Request garbage collection.
await page.requestGC();
// 3. Check that weak ref does not deref to the original object.
expect(await page.evaluate(() => !globalThis.suspectWeakRef.deref())).toBe(true);
```

**Usage**

```js
await page.requestGC();
```

**Returns**
- Promise<void>

---

### requests {/* #page-requests */}



Returns up to (currently) 100 last network request from this page. See [page.on('request')](/api/class-page.mdx#page-event-request) for more details.

Returned requests should be accessed immediately, otherwise they might be collected to prevent unbounded memory growth as new requests come in. Once collected, retrieving most information about the request is impossible.

Note that requests reported through the [page.on('request')](/api/class-page.mdx#page-event-request) request are not collected, so there is a trade off between efficient memory usage with [page.requests()](/api/class-page.mdx#page-requests) and the amount of available information reported through [page.on('request')](/api/class-page.mdx#page-event-request).

**Usage**

```js
await page.requests();
```

**Returns**
- Promise<Array<Request>>

---

### route {/* #page-route */}



Routing provides the capability to modify network requests that are made by a page.

Once routing is enabled, every request matching the url pattern will stall unless it's continued, fulfilled or aborted.

:::note

The handler will only be called for the first url if the response is a redirect.
:::

:::note
[page.route()](/api/class-page.mdx#page-route) will not intercept requests intercepted by Service Worker. See [this](https://github.com/microsoft/playwright/issues/1090) issue. We recommend disabling Service Workers when using request interception by setting [serviceWorkers](/api/class-browser.mdx#browser-new-context-option-service-workers) to `'block'`.
:::

:::note
[page.route()](/api/class-page.mdx#page-route) will not intercept the first request of a popup page. Use [browserContext.route()](/api/class-browsercontext.mdx#browser-context-route) instead.
:::

**Usage**

An example of a naive handler that aborts all image requests:

```js
const page = await browser.newPage();
await page.route('**/*.{png,jpg,jpeg}', route => route.abort());
await page.goto('https://example.com');
await browser.close();
```

or the same snippet using a regex pattern instead:

```js
const page = await browser.newPage();
await page.route(/(\.png$)|(\.jpg$)/, route => route.abort());
await page.goto('https://example.com');
await browser.close();
```

It is possible to examine the request to decide the route action. For example, mocking all requests that contain some post data, and leaving all other requests as is:

```js
await page.route('/api/**', async route => {
  if (route.request().postData().includes('my-string'))
    await route.fulfill({ body: 'mocked-data' });
  else
    await route.continue();
});
```

If a request matches multiple registered routes, the most recently registered route takes precedence.

Page routes take precedence over browser context routes (set up with [browserContext.route()](/api/class-browsercontext.mdx#browser-context-route)) when request matches both handlers.

To remove a route with its handler you can use [page.unroute()](/api/class-page.mdx#page-unroute).

:::note

Enabling routing disables http cache.
:::

**Arguments**
- `url` string | RegExp | URLPattern | function\(URL\):boolean
  
  A glob pattern, regex pattern, URL pattern, or predicate that receives a URL to match during routing. If [baseURL](/api/class-browser.mdx#browser-new-context-option-base-url) is set in the context options and the provided URL is a string that does not start with `*`, it is resolved using the [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor.
- `handler` function\(Route, Request\):Promise<Object> | Object
  
  handler function to route the request.
- `options` Object *(optional)*
  - `times` number *(optional)* 
    
    How often a route should be used. By default it will be used every time.

**Returns**
- Promise<Disposable>

---

### routeFromHAR {/* #page-route-from-har */}



If specified the network requests that are made in the page will be served from the HAR file. Read more about [Replaying from HAR](../mock.mdx#replaying-from-har).

Playwright will not serve requests intercepted by Service Worker from the HAR file. See [this](https://github.com/microsoft/playwright/issues/1090) issue. We recommend disabling Service Workers when using request interception by setting [serviceWorkers](/api/class-browser.mdx#browser-new-context-option-service-workers) to `'block'`.

**Usage**

```js
await page.routeFromHAR(har);
await page.routeFromHAR(har, options);
```

**Arguments**
- `har` string
  
  Path to a [HAR](http://www.softwareishard.com/blog/har-12-spec) file with prerecorded network data. If `path` is a relative path, then it is resolved relative to the current working directory.
- `options` Object *(optional)*
  - `notFound` "abort" | "fallback" *(optional)*
    * If set to 'abort' any request not found in the HAR file will be aborted.
    * If set to 'fallback' missing requests will be sent to the network.
    
    Defaults to abort.
  - `update` boolean *(optional)*
    
    If specified, updates the given HAR with the actual network information instead of serving from file. The file is written to disk when [browserContext.close()](/api/class-browsercontext.mdx#browser-context-close) is called.
  - `updateContent` "embed" | "attach" *(optional)* 
    
    Optional setting to control resource content management. If `attach` is specified, resources are persisted as separate files or entries in the ZIP archive. If `embed` is specified, content is stored inline the HAR file.
  - `updateMode` "full" | "minimal" *(optional)* 
    
    When set to `minimal`, only record information necessary for routing from HAR. This omits sizes, timing, page, cookies, security and other types of HAR information that are not used when replaying from HAR. Defaults to `minimal`.
  - `url` string | RegExp *(optional)*
    
    A glob pattern, regular expression or predicate to match the request URL. Only requests with URL matching the pattern will be served from the HAR file. If not specified, all requests are served from the HAR file.

**Returns**
- Promise<void>

---

### routeWebSocket {/* #page-route-web-socket */}



This method allows to modify websocket connections that are made by the page.

Note that only `WebSocket`s created after this method was called will be routed. It is recommended to call this method before navigating the page.

**Usage**

Below is an example of a simple mock that responds to a single message. See WebSocketRoute for more details and examples.

```js
await page.routeWebSocket('/ws', ws => {
  ws.onMessage(message => {
    if (message === 'request')
      ws.send('response');
  });
});
```

**Arguments**
- `url` string | RegExp | URLPattern | function\(URL\):boolean
  
  Only WebSockets with the url matching this pattern will be routed. A string pattern can be relative to the [baseURL](/api/class-browser.mdx#browser-new-context-option-base-url) context option.
- `handler` function\(WebSocketRoute\):Promise<Object> | Object
  
  Handler function to route the WebSocket.

**Returns**
- Promise<void>

---

### screenshot {/* #page-screenshot */}



Returns the buffer with the captured screenshot.

**Usage**

```js
await page.screenshot();
await page.screenshot(options);
```

**Arguments**
- `options` Object *(optional)*
  - `animations` "disabled" | "allow" *(optional)*
    
    When set to `"disabled"`, stops CSS animations, CSS transitions and Web Animations. Animations get different treatment depending on their duration:
    * finite animations are fast-forwarded to completion, so they'll fire `transitionend` event.
    * infinite animations are canceled to initial state, and then played over after the screenshot.
    
    Defaults to `"allow"` that leaves animations untouched.
  - `caret` "hide" | "initial" *(optional)*
    
    When set to `"hide"`, screenshot will hide text caret. When set to `"initial"`, text caret behavior will not be changed.  Defaults to `"hide"`.
  - `clip` Object *(optional)*
    - `x` number
      
      x-coordinate of top-left corner of clip area
    - `y` number
      
      y-coordinate of top-left corner of clip area
    - `width` number
      
      width of clipping area
    - `height` number
      
      height of clipping area
    
    An object which specifies clipping of the resulting image.
  - `fullPage` boolean *(optional)*
    
    When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Defaults to `false`.
  - `mask` Array<Locator> *(optional)*
    
    Specify locators that should be masked when the screenshot is taken. Masked elements will be overlaid with a pink box `#FF00FF` (customized by [maskColor](/api/class-page.mdx#page-screenshot-option-mask-color)) that completely covers its bounding box. The mask is also applied to invisible elements, see [Matching only visible elements](../locators.mdx#matching-only-visible-elements) to disable that.
  - `maskColor` string *(optional)* 
    
    Specify the color of the overlay box for masked elements, in [CSS color format](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value). Default color is pink `#FF00FF`.
  - `omitBackground` boolean *(optional)*
    
    Hides default white background and allows capturing screenshots with transparency. Not applicable to `jpeg` images. Defaults to `false`.
  - `path` string *(optional)*
    
    The file path to save the image to. The screenshot type will be inferred from file extension. If [path](/api/class-page.mdx#page-screenshot-option-path) is a relative path, then it is resolved relative to the current working directory. If no path is provided, the image won't be saved to the disk.
  - `quality` number *(optional)*
    
    The quality of the image, between 0-100. Not applicable to `png` images. For `jpeg` the default is `80`. For `webp`, a quality of `100` (the default) produces a lossless image, while lower values use lossy compression.
  - `scale` "css" | "device" *(optional)*
    
    When set to `"css"`, screenshot will have a single pixel per each css pixel on the page. For high-dpi devices, this will keep screenshots small. Using `"device"` option will produce a single pixel per each device pixel, so screenshots of high-dpi devices will be twice as large or even larger.
    
    Defaults to `"device"`.
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `style` string *(optional)* 
    
    Text of the stylesheet to apply while making the screenshot. This is where you can hide dynamic elements, make elements invisible or change their properties to help you creating repeatable screenshots. This stylesheet pierces the Shadow DOM and applies to the inner frames.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `type` "png" | "jpeg" | "webp" *(optional)*
    
    Specify screenshot type, defaults to `png`.

**Returns**
- Promise<Buffer>

---

### setContent {/* #page-set-content */}



This method internally calls [document.write()](https://developer.mozilla.org/en-US/docs/Web/API/Document/write), inheriting all its specific characteristics and behaviors.

**Usage**

```js
await page.setContent(html);
await page.setContent(html, options);
```

**Arguments**
- `html` string
  
  HTML markup to assign to the page.
- `options` Object *(optional)*
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `timeout` number *(optional)*
    
    Maximum operation time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `navigationTimeout` option in the config, or by using the [browserContext.setDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [page.setDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `waitUntil` "load" | "domcontentloaded" | "networkidle" | "commit" *(optional)*
    
    When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
    * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- Promise<void>

---

### setDefaultNavigationTimeout {/* #page-set-default-navigation-timeout */}



This setting will change the default maximum navigation time for the following methods and related shortcuts:
* [page.goBack()](/api/class-page.mdx#page-go-back)
* [page.goForward()](/api/class-page.mdx#page-go-forward)
* [page.goto()](/api/class-page.mdx#page-goto)
* [page.reload()](/api/class-page.mdx#page-reload)
* [page.setContent()](/api/class-page.mdx#page-set-content)
* [page.waitForNavigation()](/api/class-page.mdx#page-wait-for-navigation)
* [page.waitForURL()](/api/class-page.mdx#page-wait-for-url)

:::note

[page.setDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) takes priority over [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout), [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) and [browserContext.setDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout).
:::

**Usage**

```js
page.setDefaultNavigationTimeout(timeout);
```

**Arguments**
- `timeout` number
  
  Maximum navigation time in milliseconds

---

### setDefaultTimeout {/* #page-set-default-timeout */}



This setting will change the default maximum time for all the methods accepting [timeout](/api/class-page.mdx#page-set-default-timeout-option-timeout) option.

:::note

[page.setDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) takes priority over [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout).
:::

**Usage**

```js
page.setDefaultTimeout(timeout);
```

**Arguments**
- `timeout` number
  
  Maximum time in milliseconds. Pass `0` to disable timeout.

---

### setExtraHTTPHeaders {/* #page-set-extra-http-headers */}



The extra HTTP headers will be sent with every request the page initiates.

:::note

[page.setExtraHTTPHeaders()](/api/class-page.mdx#page-set-extra-http-headers) does not guarantee the order of headers in the outgoing requests.
:::

**Usage**

```js
await page.setExtraHTTPHeaders(headers);
```

**Arguments**
- `headers` Object<string, string>
  
  An object containing additional HTTP headers to be sent with every request. All header values must be strings.

**Returns**
- Promise<void>

---

### setViewportSize {/* #page-set-viewport-size */}



In the case of multiple pages in a single browser, each page can have its own viewport size. However, [browser.newContext()](/api/class-browser.mdx#browser-new-context) allows to set viewport size (and more) for all pages in the context at once.

[page.setViewportSize()](/api/class-page.mdx#page-set-viewport-size) will resize the page. A lot of websites don't expect phones to change size, so you should set the viewport size before navigating to the page. [page.setViewportSize()](/api/class-page.mdx#page-set-viewport-size) will also reset `screen` size, use [browser.newContext()](/api/class-browser.mdx#browser-new-context) with `screen` and `viewport` parameters if you need better control of these properties.

**Usage**

```js
const page = await browser.newPage();
await page.setViewportSize({
  width: 640,
  height: 480,
});
await page.goto('https://example.com');
```

**Arguments**
- `viewportSize` Object
  - `width` number
    
    page width in pixels.
  - `height` number
    
    page height in pixels.

**Returns**
- Promise<void>

---

### title {/* #page-title */}



Returns the page's title.

**Usage**

```js
await page.title();
```

**Returns**
- Promise<string>

---

### unroute {/* #page-unroute */}



Removes a route created with [page.route()](/api/class-page.mdx#page-route). When [handler](/api/class-page.mdx#page-unroute-option-handler) is not specified, removes all routes for the [url](/api/class-page.mdx#page-unroute-option-url).

**Usage**

```js
await page.unroute(url);
await page.unroute(url, handler);
```

**Arguments**
- `url` string | RegExp | URLPattern | function\(URL\):boolean
  
  A glob pattern, regex pattern, URL pattern, or predicate receiving URL to match while routing.
- `handler` function\(Route, Request\):Promise<Object> | Object *(optional)*
  
  Optional handler function to route the request.

**Returns**
- Promise<void>

---

### unrouteAll {/* #page-unroute-all */}



Removes all routes created with [page.route()](/api/class-page.mdx#page-route) and [page.routeFromHAR()](/api/class-page.mdx#page-route-from-har).

**Usage**

```js
await page.unrouteAll();
await page.unrouteAll(options);
```

**Arguments**
- `options` Object *(optional)*
  - `behavior` "wait" | "ignoreErrors" | "default" *(optional)*
    
    Specifies whether to wait for already running handlers and what to do if they throw errors:
    * `'default'` - do not wait for current handler calls (if any) to finish, if unrouted handler throws, it may result in unhandled error
    * `'wait'` - wait for current handler calls (if any) to finish
    * `'ignoreErrors'` - do not wait for current handler calls (if any) to finish, all errors thrown by the handlers after unrouting are silently caught

**Returns**
- Promise<void>

---

### url {/* #page-url */}



**Usage**

```js
page.url();
```

**Returns**
- string

---

### video {/* #page-video */}



Video object associated with this page. Can be used to access the video file when using the `recordVideo` context option.

**Usage**

```js
page.video();
```

**Returns**
- null | Video

---

### viewportSize {/* #page-viewport-size */}



**Usage**

```js
page.viewportSize();
```

**Returns**
- null | Object
  - `width` number
    
    page width in pixels.
  - `height` number
    
    page height in pixels.

---

### waitForEvent {/* #page-wait-for-event */}



Waits for event to fire and passes its value into the predicate function. Returns when the predicate returns truthy value. Will throw an error if the page is closed before the event is fired. Returns the event data value.

**Usage**

```js
// Start waiting for download before clicking. Note no await.
const downloadPromise = page.waitForEvent('download');
await page.getByText('Download file').click();
const download = await downloadPromise;
```

**Arguments**
- `event` string
  
  Event name, same one typically passed into `*.on(event)`.
- `optionsOrPredicate` function | Object *(optional)*
  - `predicate` function
    
    Receives the event data and resolves to truthy value when the waiting should resolve.
  - `timeout` number *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  
  Either a predicate that receives an event or an options object. Optional.
- `options` Object *(optional)*
  - `predicate` function *(optional)*
    
    Receives the event data and resolves to truthy value when the waiting should resolve.
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the waiting using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the waiting will be aborted and the operation will throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.

**Returns**
- Promise<Object>

---

### waitForFunction {/* #page-wait-for-function */}



Returns when the [pageFunction](/api/class-page.mdx#page-wait-for-function-option-expression) returns a truthy value. It resolves to a JSHandle of the truthy value.

**Usage**

The [page.waitForFunction()](/api/class-page.mdx#page-wait-for-function) can be used to observe viewport size change:

```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.

(async () => {
  const browser = await webkit.launch();
  const page = await browser.newPage();
  const watchDog = page.waitForFunction(() => window.innerWidth < 100);
  await page.setViewportSize({ width: 50, height: 50 });
  await watchDog;
  await browser.close();
})();
```

To pass an argument to the predicate of [page.waitForFunction()](/api/class-page.mdx#page-wait-for-function) function:

```js
const selector = '.foo';
await page.waitForFunction(selector => !!document.querySelector(selector), selector);
```

**Arguments**
- `pageFunction` function | string
  
  Function to be evaluated in the page context.
- `arg` EvaluationArgument *(optional)*
  
  Optional argument to pass to [pageFunction](/api/class-page.mdx#page-wait-for-function-option-expression).
- `options` Object *(optional)*
  - `polling` number | "raf" *(optional)*
    
    If [polling](/api/class-page.mdx#page-wait-for-function-option-polling) is `'raf'`, then [pageFunction](/api/class-page.mdx#page-wait-for-function-option-expression) is constantly executed in `requestAnimationFrame` callback. If [polling](/api/class-page.mdx#page-wait-for-function-option-polling) is a number, then it is treated as an interval in milliseconds at which the function would be executed. Defaults to `raf`.
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `timeout` number *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Promise<JSHandle>

---

### waitForLoadState {/* #page-wait-for-load-state */}



Returns when the required load state has been reached.

This resolves when the page reaches a required load state, `load` by default. The navigation must have been committed when this method is called. If current document has already reached the required state, resolves immediately.

:::note

Most of the time, this method is not needed because Playwright [auto-waits before every action](../actionability.mdx).
:::

**Usage**

```js
await page.getByRole('button').click(); // Click triggers navigation.
await page.waitForLoadState(); // The promise resolves after 'load' event.
```

```js
const popupPromise = page.waitForEvent('popup');
await page.getByRole('button').click(); // Click triggers a popup.
const popup = await popupPromise;
await popup.waitForLoadState('domcontentloaded'); // Wait for the 'DOMContentLoaded' event.
console.log(await popup.title()); // Popup is ready to use.
```

**Arguments**
- `state` "load" | "domcontentloaded" | "networkidle" *(optional)*
  
  Optional load state to wait for, defaults to `load`. If the state has been already reached while loading current document, the method resolves immediately. Can be one of:
  * `'load'` - wait for the `load` event to be fired.
  * `'domcontentloaded'` - wait for the `DOMContentLoaded` event to be fired.
  * `'networkidle'` - **DISCOURAGED** wait until there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
- `options` Object *(optional)*
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the waiting using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the waiting will be aborted and the operation will throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `timeout` number *(optional)*
    
    Maximum operation time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `navigationTimeout` option in the config, or by using the [browserContext.setDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [page.setDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Promise<void>

---

### waitForRequest {/* #page-wait-for-request */}



Waits for the matching request and returns it. See [waiting for event](../events.mdx#waiting-for-event) for more details about events.

**Usage**

```js
// Start waiting for request before clicking. Note no await.
const requestPromise = page.waitForRequest('https://example.com/resource');
await page.getByText('trigger request').click();
const request = await requestPromise;

// Alternative way with a predicate. Note no await.
const requestPromise = page.waitForRequest(request =>
  request.url() === 'https://example.com' && request.method() === 'GET',
);
await page.getByText('trigger request').click();
const request = await requestPromise;
```

**Arguments**
- `urlOrPredicate` string | RegExp | function\(Request\):boolean | Promise<boolean>
  
  Request URL string, regex or predicate receiving Request object.
- `options` Object *(optional)*
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the waiting using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the waiting will be aborted and the operation will throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `timeout` number *(optional)*
    
    Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be changed by using the [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) method.

**Returns**
- Promise<Request>

---

### waitForResponse {/* #page-wait-for-response */}



Returns the matched response. See [waiting for event](../events.mdx#waiting-for-event) for more details about events.

**Usage**

```js
// Start waiting for response before clicking. Note no await.
const responsePromise = page.waitForResponse('https://example.com/resource');
await page.getByText('trigger response').click();
const response = await responsePromise;

// Alternative way with a predicate. Note no await.
const responsePromise = page.waitForResponse(response =>
  response.url() === 'https://example.com' && response.status() === 200
      && response.request().method() === 'GET'
);
await page.getByText('trigger response').click();
const response = await responsePromise;
```

**Arguments**
- `urlOrPredicate` string | RegExp | function\(Response\):boolean | Promise<boolean>
  
  Request URL string, regex or predicate receiving Response object. When a [baseURL](/api/class-browser.mdx#browser-new-context-option-base-url) via the context options was provided and the passed URL is a path, it gets merged via the [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor.
- `options` Object *(optional)*
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the waiting using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the waiting will be aborted and the operation will throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `timeout` number *(optional)*
    
    Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be changed by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Promise<Response>

---

### waitForURL {/* #page-wait-for-url */}



Waits for the main frame to navigate to the given URL.

**Usage**

```js
await page.click('a.delayed-navigation'); // Clicking the link will indirectly cause a navigation
await page.waitForURL('**/target.html');
```

**Arguments**
- `url` string | RegExp | URLPattern | function\(URL\):boolean
  
  A glob pattern, regex pattern, URL pattern, or predicate receiving URL to match while waiting for the navigation. Note that if the parameter is a string without wildcard characters, the method will wait for navigation to URL that is exactly equal to the string.
- `options` Object *(optional)*
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the waiting using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the waiting will be aborted and the operation will throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `timeout` number *(optional)*
    
    Maximum operation time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `navigationTimeout` option in the config, or by using the [browserContext.setDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [page.setDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `waitUntil` "load" | "domcontentloaded" | "networkidle" | "commit" *(optional)*
    
    When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
    * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- Promise<void>

---

### workers {/* #page-workers */}



This method returns all of the dedicated [WebWorkers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) associated with the page.

:::note

This does not contain ServiceWorkers
:::

**Usage**

```js
page.workers();
```

**Returns**
- Array<Worker>

---

## Properties

### clock {/* #page-clock */}



Playwright has ability to mock clock and passage of time.

**Usage**

```js
page.clock
```

**Type**
- Clock

---

### coverage {/* #page-coverage */}



:::note

Only available for Chromium atm.
:::

Browser-specific Coverage implementation. See [Coverage](./class-coverage) for more details.

**Usage**

```js
page.coverage
```

**Type**
- Coverage

---

### keyboard {/* #page-keyboard */}



**Usage**

```js
page.keyboard
```

**Type**
- Keyboard

---

### localStorage {/* #page-local-storage */}



Provides access to the page's `localStorage` for the current origin. See WebStorage.

```js
await page.localStorage.setItem('token', 'abc');
const token = await page.localStorage.getItem('token');
```

**Usage**

```js
page.localStorage
```

**Type**
- WebStorage

---

### mouse {/* #page-mouse */}



**Usage**

```js
page.mouse
```

**Type**
- Mouse

---

### request {/* #page-request */}



API testing helper associated with this page. This method returns the same instance as [browserContext.request](/api/class-browsercontext.mdx#browser-context-request) on the page's context. See [browserContext.request](/api/class-browsercontext.mdx#browser-context-request) for more details.

**Usage**

```js
page.request
```

**Type**
- APIRequestContext

---

### screencast {/* #page-screencast */}



Screencast object associated with this page.

**Usage**

```js
page.screencast.on('screencastFrame', data => {
  console.log('received frame, jpeg size:', data.length);
});
await page.screencast.start();
// ... perform actions ...
await page.screencast.stop();
```

**Type**
- Screencast

---

### sessionStorage {/* #page-session-storage */}



Provides access to the page's `sessionStorage` for the current origin. See WebStorage.

```js
await page.sessionStorage.setItem('flag', '1');
const flag = await page.sessionStorage.getItem('flag');
```

**Usage**

```js
page.sessionStorage
```

**Type**
- WebStorage

---

### touchscreen {/* #page-touchscreen */}



**Usage**

```js
page.touchscreen
```

**Type**
- Touchscreen

---

## Events

### on('close') {/* #page-event-close */}



Emitted when the page closes.

**Usage**

```js
page.on('close', data => {});
```

**Event data**
- Page

---

### on('console') {/* #page-event-console */}



Emitted when JavaScript within the page calls one of console API methods, e.g. `console.log` or `console.dir`.

The arguments passed into `console.log` are available on the ConsoleMessage event handler argument.

**Usage**

```js
page.on('console', async msg => {
  const values = [];
  for (const arg of msg.args())
    values.push(await arg.jsonValue());
  console.log(...values);
});
await page.evaluate(() => console.log('hello', 5, { foo: 'bar' }));
```

**Event data**
- ConsoleMessage

---

### on('crash') {/* #page-event-crash */}



Emitted when the page crashes. Browser pages might crash if they try to allocate too much memory. When the page crashes, ongoing and subsequent operations will throw.

The most common way to deal with crashes is to catch an exception:

```js
try {
  // Crash might happen during a click.
  await page.click('button');
  // Or while waiting for an event.
  await page.waitForEvent('popup');
} catch (e) {
  // When the page crashes, exception message contains 'crash'.
}
```

**Usage**

```js
page.on('crash', data => {});
```

**Event data**
- Page

---

### on('dialog') {/* #page-event-dialog */}



Emitted when a JavaScript dialog appears, such as `alert`, `prompt`, `confirm` or `beforeunload`. Listener **must** either [dialog.accept()](/api/class-dialog.mdx#dialog-accept) or [dialog.dismiss()](/api/class-dialog.mdx#dialog-dismiss) the dialog - otherwise the page will [freeze](https://developer.mozilla.org/en-US/docs/Web/JavaScript/EventLoop#never_blocking) waiting for the dialog, and actions like click will never finish.

**Usage**

```js
page.on('dialog', dialog => dialog.accept());
```

:::note
When no [page.on('dialog')](/api/class-page.mdx#page-event-dialog) or [browserContext.on('dialog')](/api/class-browsercontext.mdx#browser-context-event-dialog) listeners are present, all dialogs are automatically dismissed.
:::

**Event data**
- Dialog

---

### on('domcontentloaded') {/* #page-event-dom-content-loaded */}



Emitted when the JavaScript [`DOMContentLoaded`](https://developer.mozilla.org/en-US/docs/Web/Events/DOMContentLoaded) event is dispatched.

**Usage**

```js
page.on('domcontentloaded', data => {});
```

**Event data**
- Page

---

### on('download') {/* #page-event-download */}



Emitted when attachment download started. User can access basic file operations on downloaded content via the passed Download instance.

**Usage**

```js
page.on('download', data => {});
```

**Event data**
- Download

---

### on('filechooser') {/* #page-event-file-chooser */}



Emitted when a file chooser is supposed to appear, such as after clicking the  `<input type=file>`. Playwright can respond to it via setting the input files using [fileChooser.setFiles()](/api/class-filechooser.mdx#file-chooser-set-files) that can be uploaded after that.

```js
page.on('filechooser', async fileChooser => {
  await fileChooser.setFiles(path.join(__dirname, '/tmp/myfile.pdf'));
});
```

**Usage**

```js
page.on('filechooser', data => {});
```

**Event data**
- FileChooser

---

### on('frameattached') {/* #page-event-frame-attached */}



Emitted when a frame is attached.

**Usage**

```js
page.on('frameattached', data => {});
```

**Event data**
- Frame

---

### on('framedetached') {/* #page-event-frame-detached */}



Emitted when a frame is detached.

**Usage**

```js
page.on('framedetached', data => {});
```

**Event data**
- Frame

---

### on('framenavigated') {/* #page-event-frame-navigated */}



Emitted when a frame is navigated to a new url.

**Usage**

```js
page.on('framenavigated', data => {});
```

**Event data**
- Frame

---

### on('load') {/* #page-event-load */}



Emitted when the JavaScript [`load`](https://developer.mozilla.org/en-US/docs/Web/Events/load) event is dispatched.

**Usage**

```js
page.on('load', data => {});
```

**Event data**
- Page

---

### on('pageerror') {/* #page-event-page-error */}



Emitted when an uncaught exception happens within the page.

```js
// Log all uncaught errors to the terminal
page.on('pageerror', exception => {
  console.log(`Uncaught exception: "${exception}"`);
});

// Navigate to a page with an exception.
await page.goto('data:text/html,<script>throw new Error("Test")</script>');
```

**Usage**

```js
page.on('pageerror', data => {});
```

**Event data**
- Error

---

### on('popup') {/* #page-event-popup */}



Emitted when the page opens a new tab or window. This event is emitted in addition to the [browserContext.on('page')](/api/class-browsercontext.mdx#browser-context-event-page), but only for popups relevant to this page.

The earliest moment that page is available is when it has navigated to the initial url. For example, when opening a popup with `window.open('http://example.com')`, this event will fire when the network request to "http://example.com" is done and its response has started loading in the popup. If you would like to route/listen to this network request, use [browserContext.route()](/api/class-browsercontext.mdx#browser-context-route) and [browserContext.on('request')](/api/class-browsercontext.mdx#browser-context-event-request) respectively instead of similar methods on the Page.

```js
// Start waiting for popup before clicking. Note no await.
const popupPromise = page.waitForEvent('popup');
await page.getByText('open the popup').click();
const popup = await popupPromise;
console.log(await popup.evaluate('location.href'));
```

:::note
Use [page.waitForLoadState()](/api/class-page.mdx#page-wait-for-load-state) to wait until the page gets to a particular state (you should not need it in most cases).
:::

**Usage**

```js
page.on('popup', data => {});
```

**Event data**
- Page

---

### on('request') {/* #page-event-request */}



Emitted when a page issues a request. The request object is read-only. In order to intercept and mutate requests, see [page.route()](/api/class-page.mdx#page-route) or [browserContext.route()](/api/class-browsercontext.mdx#browser-context-route).

**Usage**

```js
page.on('request', data => {});
```

**Event data**
- Request

---

### on('requestfailed') {/* #page-event-request-failed */}



Emitted when a request fails, for example by timing out.

```js
page.on('requestfailed', request => {
  console.log(request.url() + ' ' + request.failure().errorText);
});
```

:::note
HTTP Error responses, such as 404 or 503, are still successful responses from HTTP standpoint, so request will complete with [page.on('requestfinished')](/api/class-page.mdx#page-event-request-finished) event and not with [page.on('requestfailed')](/api/class-page.mdx#page-event-request-failed). A request will only be considered failed when the client cannot get an HTTP response from the server, e.g. due to network error net::ERR_FAILED.
:::

**Usage**

```js
page.on('requestfailed', data => {});
```

**Event data**
- Request

---

### on('requestfinished') {/* #page-event-request-finished */}



Emitted when a request finishes successfully after downloading the response body. For a successful response, the sequence of events is `request`, `response` and `requestfinished`.

**Usage**

```js
page.on('requestfinished', data => {});
```

**Event data**
- Request

---

### on('response') {/* #page-event-response */}



Emitted when response status and headers are received for a request. For a successful response, the sequence of events is `request`, `response` and `requestfinished`.

**Usage**

```js
page.on('response', data => {});
```

**Event data**
- Response

---

### on('websocket') {/* #page-event-web-socket */}



Emitted when WebSocket request is sent.

**Usage**

```js
page.on('websocket', data => {});
```

**Event data**
- WebSocket

---

### on('worker') {/* #page-event-worker */}



Emitted when a dedicated [WebWorker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) is spawned by the page.

**Usage**

```js
page.on('worker', data => {});
```

**Event data**
- Worker

---

## Deprecated

### $ {/* #page-query-selector */}



:::warningDiscouraged

Use locator-based [page.locator()](/api/class-page.mdx#page-locator) instead. Read more about [locators](../locators.mdx).

:::


The method finds an element matching the specified selector within the page. If no elements match the selector, the return value resolves to `null`. To wait for an element on the page, use [locator.waitFor()](/api/class-locator.mdx#locator-wait-for).

**Usage**

```js
await page.$(selector);
await page.$(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to query for.
- `options` Object *(optional)*
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.

**Returns**
- Promise<null | ElementHandle>

---

### $$ {/* #page-query-selector-all */}



:::warningDiscouraged

Use locator-based [page.locator()](/api/class-page.mdx#page-locator) instead. Read more about [locators](../locators.mdx).

:::


The method finds all elements matching the specified selector within the page. If no elements match the selector, the return value resolves to `[]`.

**Usage**

```js
await page.$$(selector);
```

**Arguments**
- `selector` string
  
  A selector to query for.

**Returns**
- Promise<Array<ElementHandle>>

---

### $eval {/* #page-eval-on-selector */}



:::warningDiscouraged

This method does not wait for the element to pass actionability checks and therefore can lead to the flaky tests. Use [locator.evaluate()](/api/class-locator.mdx#locator-evaluate), other Locator helper methods or web-first assertions instead.

:::


The method finds an element matching the specified selector within the page and passes it as a first argument to [pageFunction](/api/class-page.mdx#page-eval-on-selector-option-expression). If no elements match the selector, the method throws an error. Returns the value of [pageFunction](/api/class-page.mdx#page-eval-on-selector-option-expression).

If [pageFunction](/api/class-page.mdx#page-eval-on-selector-option-expression) returns a Promise, then [page.$eval()](/api/class-page.mdx#page-eval-on-selector) would wait for the promise to resolve and return its value.

**Usage**

```js
const searchValue = await page.$eval('#search', el => el.value);
const preloadHref = await page.$eval('linkrel=preload', el => el.href);
const html = await page.$eval('.main-container', (e, suffix) => e.outerHTML + suffix, 'hello');
// In TypeScript, this example requires an explicit type annotation (HTMLLinkElement) on el:
const preloadHrefTS = await page.$eval('linkrel=preload', (el: HTMLLinkElement) => el.href);
```

**Arguments**
- `selector` string
  
  A selector to query for.
- `pageFunction` function\(Element\) | string
  
  Function to be evaluated in the page context.
- `arg` EvaluationArgument *(optional)*
  
  Optional argument to pass to [pageFunction](/api/class-page.mdx#page-eval-on-selector-option-expression).
- `options` Object *(optional)*
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.

**Returns**
- Promise<Serializable>

---

### $$eval {/* #page-eval-on-selector-all */}



:::warningDiscouraged

In most cases, [locator.evaluateAll()](/api/class-locator.mdx#locator-evaluate-all), other Locator helper methods and web-first assertions do a better job.

:::


The method finds all elements matching the specified selector within the page and passes an array of matched elements as a first argument to [pageFunction](/api/class-page.mdx#page-eval-on-selector-all-option-expression). Returns the result of [pageFunction](/api/class-page.mdx#page-eval-on-selector-all-option-expression) invocation.

If [pageFunction](/api/class-page.mdx#page-eval-on-selector-all-option-expression) returns a Promise, then [page.$$eval()](/api/class-page.mdx#page-eval-on-selector-all) would wait for the promise to resolve and return its value.

**Usage**

```js
const divCounts = await page.$$eval('div', (divs, min) => divs.length >= min, 10);
```

**Arguments**
- `selector` string
  
  A selector to query for.
- `pageFunction` function\(Array<Element>\) | string
  
  Function to be evaluated in the page context.
- `arg` EvaluationArgument *(optional)*
  
  Optional argument to pass to [pageFunction](/api/class-page.mdx#page-eval-on-selector-all-option-expression).

**Returns**
- Promise<Serializable>

---

### check {/* #page-check */}



:::warningDiscouraged

Use locator-based [locator.check()](/api/class-locator.mdx#locator-check) instead. Read more about [locators](../locators.mdx).

:::


This method checks an element matching [selector](/api/class-page.mdx#page-check-option-selector) by performing the following steps:
1. Find an element matching [selector](/api/class-page.mdx#page-check-option-selector). If there is none, wait until a matching element is attached to the DOM.
1. Ensure that matched element is a checkbox or a radio input. If not, this method throws. If the element is already checked, this method returns immediately.
1. Wait for [actionability](../actionability.mdx) checks on the matched element, unless [force](/api/class-page.mdx#page-check-option-force) option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.mouse](/api/class-page.mdx#page-mouse) to click in the center of the element.
1. Ensure that the element is now checked. If not, this method throws.

When all steps combined have not finished during the specified [timeout](/api/class-page.mdx#page-check-option-timeout), this method throws a TimeoutError. Passing zero timeout disables this.

**Usage**

```js
await page.check(selector);
await page.check(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` Object *(optional)*
  - `force` boolean *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `noWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `position` Object *(optional)* 
    - `x` number
      
      
    - `y` number
      
      
    A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
  - `scroll` "auto" | "none" *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `trial` boolean *(optional)* 
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it.

**Returns**
- Promise<void>

---

### click {/* #page-click */}



:::warningDiscouraged

Use locator-based [locator.click()](/api/class-locator.mdx#locator-click) instead. Read more about [locators](../locators.mdx).

:::


This method clicks an element matching [selector](/api/class-page.mdx#page-click-option-selector) by performing the following steps:
1. Find an element matching [selector](/api/class-page.mdx#page-click-option-selector). If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](../actionability.mdx) checks on the matched element, unless [force](/api/class-page.mdx#page-click-option-force) option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.mouse](/api/class-page.mdx#page-mouse) to click in the center of the element, or the specified [position](/api/class-page.mdx#page-click-option-position).
1. Wait for initiated navigations to either succeed or fail, unless [noWaitAfter](/api/class-page.mdx#page-click-option-no-wait-after) option is set.

When all steps combined have not finished during the specified [timeout](/api/class-page.mdx#page-click-option-timeout), this method throws a TimeoutError. Passing zero timeout disables this.

**Usage**

```js
await page.click(selector);
await page.click(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` Object *(optional)*
  - `button` "left" | "right" | "middle" *(optional)*
    
    Defaults to `left`.
  - `clickCount` number *(optional)*
    
    defaults to 1. See UIEvent.detail.
  - `delay` number *(optional)*
    
    Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `force` boolean *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `modifiers` Array<"Alt" | "Control" | "ControlOrMeta" | "Meta" | "Shift"> *(optional)*
    
    Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used. "ControlOrMeta" resolves to "Control" on Windows and Linux and to "Meta" on macOS.
  - `noWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option will default to `true` in the future.
    :::
    
    
    Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `position` Object *(optional)*
    - `x` number
      
      
    - `y` number
      
      
    A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
  - `scroll` "auto" | "none" *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `trial` boolean *(optional)* 
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it. Note that keyboard `modifiers` will be pressed regardless of `trial` to allow testing elements which are only visible when those keys are pressed.

**Returns**
- Promise<void>

---

### dblclick {/* #page-dblclick */}



:::warningDiscouraged

Use locator-based [locator.dblclick()](/api/class-locator.mdx#locator-dblclick) instead. Read more about [locators](../locators.mdx).

:::


This method double clicks an element matching [selector](/api/class-page.mdx#page-dblclick-option-selector) by performing the following steps:
1. Find an element matching [selector](/api/class-page.mdx#page-dblclick-option-selector). If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](../actionability.mdx) checks on the matched element, unless [force](/api/class-page.mdx#page-dblclick-option-force) option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.mouse](/api/class-page.mdx#page-mouse) to double click in the center of the element, or the specified [position](/api/class-page.mdx#page-dblclick-option-position).

When all steps combined have not finished during the specified [timeout](/api/class-page.mdx#page-dblclick-option-timeout), this method throws a TimeoutError. Passing zero timeout disables this.

:::note

`page.dblclick()` dispatches two `click` events and a single `dblclick` event.
:::

**Usage**

```js
await page.dblclick(selector);
await page.dblclick(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` Object *(optional)*
  - `button` "left" | "right" | "middle" *(optional)*
    
    Defaults to `left`.
  - `delay` number *(optional)*
    
    Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `force` boolean *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `modifiers` Array<"Alt" | "Control" | "ControlOrMeta" | "Meta" | "Shift"> *(optional)*
    
    Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used. "ControlOrMeta" resolves to "Control" on Windows and Linux and to "Meta" on macOS.
  - `noWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `position` Object *(optional)*
    - `x` number
      
      
    - `y` number
      
      
    A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
  - `scroll` "auto" | "none" *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `trial` boolean *(optional)* 
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it. Note that keyboard `modifiers` will be pressed regardless of `trial` to allow testing elements which are only visible when those keys are pressed.

**Returns**
- Promise<void>

---

### dispatchEvent {/* #page-dispatch-event */}



:::warningDiscouraged

Use locator-based [locator.dispatchEvent()](/api/class-locator.mdx#locator-dispatch-event) instead. Read more about [locators](../locators.mdx).

:::


The snippet below dispatches the `click` event on the element. Regardless of the visibility state of the element, `click` is dispatched. This is equivalent to calling [element.click()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click).

**Usage**

```js
await page.dispatchEvent('button#submit', 'click');
```

Under the hood, it creates an instance of an event based on the given [type](/api/class-page.mdx#page-dispatch-event-option-type), initializes it with [eventInit](/api/class-page.mdx#page-dispatch-event-option-event-init) properties and dispatches it on the element. Events are `composed`, `cancelable` and bubble by default.

Since [eventInit](/api/class-page.mdx#page-dispatch-event-option-event-init) is event-specific, please refer to the events documentation for the lists of initial properties:
* [DeviceMotionEvent](https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/DeviceMotionEvent)
* [DeviceOrientationEvent](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/DeviceOrientationEvent)
* [DragEvent](https://developer.mozilla.org/en-US/docs/Web/API/DragEvent/DragEvent)
* [Event](https://developer.mozilla.org/en-US/docs/Web/API/Event/Event)
* [FocusEvent](https://developer.mozilla.org/en-US/docs/Web/API/FocusEvent/FocusEvent)
* [KeyboardEvent](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/KeyboardEvent)
* [MouseEvent](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/MouseEvent)
* [PointerEvent](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/PointerEvent)
* [TouchEvent](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/TouchEvent)
* [WheelEvent](https://developer.mozilla.org/en-US/docs/Web/API/WheelEvent/WheelEvent)

You can also specify `JSHandle` as the property value if you want live objects to be passed into the event:

```js
// Note you can only create DataTransfer in Chromium and Firefox
const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
await page.dispatchEvent('#source', 'dragstart', { dataTransfer });
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `type` string
  
  DOM event type: `"click"`, `"dragstart"`, etc.
- `eventInit` EvaluationArgument *(optional)*
  
  Optional event-specific initialization properties.
- `options` Object *(optional)*
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Promise<void>

---

### fill {/* #page-fill */}



:::warningDiscouraged

Use locator-based [locator.fill()](/api/class-locator.mdx#locator-fill) instead. Read more about [locators](../locators.mdx).

:::


This method waits for an element matching [selector](/api/class-page.mdx#page-fill-option-selector), waits for [actionability](../actionability.mdx) checks, focuses the element, fills it and triggers an `input` event after filling. Note that you can pass an empty string to clear the input field.

If the target element is not an `<input>`, `<textarea>` or `contenteditable` element, this method throws an error. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), the control will be filled instead.

To send fine-grained keyboard events, use [locator.pressSequentially()](/api/class-locator.mdx#locator-press-sequentially).

**Usage**

```js
await page.fill(selector, value);
await page.fill(selector, value, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `value` string
  
  Value to fill for the `<input>`, `<textarea>` or `contenteditable` element.
- `options` Object *(optional)*
  - `force` boolean *(optional)* 
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `noWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Promise<void>

---

### focus {/* #page-focus */}



:::warningDiscouraged

Use locator-based [locator.focus()](/api/class-locator.mdx#locator-focus) instead. Read more about [locators](../locators.mdx).

:::


This method fetches an element with [selector](/api/class-page.mdx#page-focus-option-selector) and focuses it. If there's no element matching [selector](/api/class-page.mdx#page-focus-option-selector), the method waits until a matching element appears in the DOM.

**Usage**

```js
await page.focus(selector);
await page.focus(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` Object *(optional)*
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Promise<void>

---

### getAttribute {/* #page-get-attribute */}



:::warningDiscouraged

Use locator-based [locator.getAttribute()](/api/class-locator.mdx#locator-get-attribute) instead. Read more about [locators](../locators.mdx).

:::


Returns element attribute value.

**Usage**

```js
await page.getAttribute(selector, name);
await page.getAttribute(selector, name, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `name` string
  
  Attribute name to get the value for.
- `options` Object *(optional)*
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Promise<null | string>

---

### hover {/* #page-hover */}



:::warningDiscouraged

Use locator-based [locator.hover()](/api/class-locator.mdx#locator-hover) instead. Read more about [locators](../locators.mdx).

:::


This method hovers over an element matching [selector](/api/class-page.mdx#page-hover-option-selector) by performing the following steps:
1. Find an element matching [selector](/api/class-page.mdx#page-hover-option-selector). If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](../actionability.mdx) checks on the matched element, unless [force](/api/class-page.mdx#page-hover-option-force) option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.mouse](/api/class-page.mdx#page-mouse) to hover over the center of the element, or the specified [position](/api/class-page.mdx#page-hover-option-position).

When all steps combined have not finished during the specified [timeout](/api/class-page.mdx#page-hover-option-timeout), this method throws a TimeoutError. Passing zero timeout disables this.

**Usage**

```js
await page.hover(selector);
await page.hover(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` Object *(optional)*
  - `force` boolean *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `modifiers` Array<"Alt" | "Control" | "ControlOrMeta" | "Meta" | "Shift"> *(optional)*
    
    Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used. "ControlOrMeta" resolves to "Control" on Windows and Linux and to "Meta" on macOS.
  - `noWaitAfter` boolean *(optional)* 
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `position` Object *(optional)*
    - `x` number
      
      
    - `y` number
      
      
    A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
  - `scroll` "auto" | "none" *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `trial` boolean *(optional)* 
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it. Note that keyboard `modifiers` will be pressed regardless of `trial` to allow testing elements which are only visible when those keys are pressed.

**Returns**
- Promise<void>

---

### innerHTML {/* #page-inner-html */}



:::warningDiscouraged

Use locator-based [locator.innerHTML()](/api/class-locator.mdx#locator-inner-html) instead. Read more about [locators](../locators.mdx).

:::


Returns `element.innerHTML`.

**Usage**

```js
await page.innerHTML(selector);
await page.innerHTML(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` Object *(optional)*
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Promise<string>

---

### innerText {/* #page-inner-text */}



:::warningDiscouraged

Use locator-based [locator.innerText()](/api/class-locator.mdx#locator-inner-text) instead. Read more about [locators](../locators.mdx).

:::


Returns `element.innerText`.

**Usage**

```js
await page.innerText(selector);
await page.innerText(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` Object *(optional)*
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Promise<string>

---

### inputValue {/* #page-input-value */}



:::warningDiscouraged

Use locator-based [locator.inputValue()](/api/class-locator.mdx#locator-input-value) instead. Read more about [locators](../locators.mdx).

:::


Returns `input.value` for the selected `<input>` or `<textarea>` or `<select>` element.

Throws for non-input elements. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), returns the value of the control.

**Usage**

```js
await page.inputValue(selector);
await page.inputValue(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` Object *(optional)*
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Promise<string>

---

### isChecked {/* #page-is-checked */}



:::warningDiscouraged

Use locator-based [locator.isChecked()](/api/class-locator.mdx#locator-is-checked) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is checked. Throws if the element is not a checkbox or radio input.

**Usage**

```js
await page.isChecked(selector);
await page.isChecked(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` Object *(optional)*
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Promise<boolean>

---

### isDisabled {/* #page-is-disabled */}



:::warningDiscouraged

Use locator-based [locator.isDisabled()](/api/class-locator.mdx#locator-is-disabled) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is disabled, the opposite of [enabled](../actionability.mdx#enabled).

**Usage**

```js
await page.isDisabled(selector);
await page.isDisabled(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` Object *(optional)*
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Promise<boolean>

---

### isEditable {/* #page-is-editable */}



:::warningDiscouraged

Use locator-based [locator.isEditable()](/api/class-locator.mdx#locator-is-editable) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is [editable](../actionability.mdx#editable).

**Usage**

```js
await page.isEditable(selector);
await page.isEditable(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` Object *(optional)*
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Promise<boolean>

---

### isEnabled {/* #page-is-enabled */}



:::warningDiscouraged

Use locator-based [locator.isEnabled()](/api/class-locator.mdx#locator-is-enabled) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is [enabled](../actionability.mdx#enabled).

**Usage**

```js
await page.isEnabled(selector);
await page.isEnabled(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` Object *(optional)*
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Promise<boolean>

---

### isHidden {/* #page-is-hidden */}



:::warningDiscouraged

Use locator-based [locator.isHidden()](/api/class-locator.mdx#locator-is-hidden) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is hidden, the opposite of [visible](../actionability.mdx#visible).  [selector](/api/class-page.mdx#page-is-hidden-option-selector) that does not match any elements is considered hidden.

**Usage**

```js
await page.isHidden(selector);
await page.isHidden(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` Object *(optional)*
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    :::warningDeprecated
    This option is ignored. [page.isHidden()](/api/class-page.mdx#page-is-hidden) does not wait for the element to become hidden and returns immediately.
    :::
    

**Returns**
- Promise<boolean>

---

### isVisible {/* #page-is-visible */}



:::warningDiscouraged

Use locator-based [locator.isVisible()](/api/class-locator.mdx#locator-is-visible) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is [visible](../actionability.mdx#visible). [selector](/api/class-page.mdx#page-is-visible-option-selector) that does not match any elements is considered not visible.

**Usage**

```js
await page.isVisible(selector);
await page.isVisible(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` Object *(optional)*
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    :::warningDeprecated
    This option is ignored. [page.isVisible()](/api/class-page.mdx#page-is-visible) does not wait for the element to become visible and returns immediately.
    :::
    

**Returns**
- Promise<boolean>

---

### press {/* #page-press */}



:::warningDiscouraged

Use locator-based [locator.press()](/api/class-locator.mdx#locator-press) instead. Read more about [locators](../locators.mdx).

:::


Focuses the element, and then uses [keyboard.down()](/api/class-keyboard.mdx#keyboard-down) and [keyboard.up()](/api/class-keyboard.mdx#keyboard-up).

[key](/api/class-page.mdx#page-press-option-key) can specify the intended [keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) value or a single character to generate the text for. A superset of the [key](/api/class-page.mdx#page-press-option-key) values can be found [here](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values). Examples of the keys are:

`F1` - `F12`, `Digit0`- `Digit9`, `KeyA`- `KeyZ`, `Backquote`, `Minus`, `Equal`, `Backslash`, `Backspace`, `Tab`, `Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`, `PageDown`, `PageUp`, `ArrowRight`, `ArrowUp`, etc.

Following modification shortcuts are also supported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`, `ControlOrMeta`. `ControlOrMeta` resolves to `Control` on Windows and Linux and to `Meta` on macOS.

Holding down `Shift` will type the text that corresponds to the [key](/api/class-page.mdx#page-press-option-key) in the upper case.

If [key](/api/class-page.mdx#page-press-option-key) is a single character, it is case-sensitive, so the values `a` and `A` will generate different respective texts.

Shortcuts such as `key: "Control+o"`, `key: "Control++` or `key: "Control+Shift+T"` are supported as well. When specified with the modifier, modifier is pressed and being held while the subsequent key is being pressed.

**Usage**

```js
const page = await browser.newPage();
await page.goto('https://keycode.info');
await page.press('body', 'A');
await page.screenshot({ path: 'A.png' });
await page.press('body', 'ArrowLeft');
await page.screenshot({ path: 'ArrowLeft.png' });
await page.press('body', 'Shift+O');
await page.screenshot({ path: 'O.png' });
await browser.close();
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `key` string
  
  Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.
- `options` Object *(optional)*
  - `delay` number *(optional)*
    
    Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.
  - `noWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option will default to `true` in the future.
    :::
    
    
    Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Promise<void>

---

### selectOption {/* #page-select-option */}



:::warningDiscouraged

Use locator-based [locator.selectOption()](/api/class-locator.mdx#locator-select-option) instead. Read more about [locators](../locators.mdx).

:::


This method waits for an element matching [selector](/api/class-page.mdx#page-select-option-option-selector), waits for [actionability](../actionability.mdx) checks, waits until all specified options are present in the `<select>` element and selects these options.

If the target element is not a `<select>` element, this method throws an error. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), the control will be used instead.

Returns the array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected.

**Usage**

```js
// Single selection matching the value or label
page.selectOption('select#colors', 'blue');

// single selection matching the label
page.selectOption('select#colors', { label: 'Blue' });

// multiple selection
page.selectOption('select#colors', 'red', 'green', 'blue');

```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `values` null | string | ElementHandle | Array<string> | Object | Array<ElementHandle> | Array<Object>
  - `value` string *(optional)*
    
    Matches by `option.value`. Optional.
  - `label` string *(optional)*
    
    Matches by `option.label`. Optional.
  - `index` number *(optional)*
    
    Matches by the index. Optional.
  
  Options to select. If the `<select>` has the `multiple` attribute, all matching options are selected, otherwise only the first option matching one of the passed options is selected. String values are matching both values and labels. Option is considered matching if all specified properties match.
- `options` Object *(optional)*
  - `force` boolean *(optional)* 
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `noWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Promise<Array<string>>

---

### setChecked {/* #page-set-checked */}



:::warningDiscouraged

Use locator-based [locator.setChecked()](/api/class-locator.mdx#locator-set-checked) instead. Read more about [locators](../locators.mdx).

:::


This method checks or unchecks an element matching [selector](/api/class-page.mdx#page-set-checked-option-selector) by performing the following steps:
1. Find an element matching [selector](/api/class-page.mdx#page-set-checked-option-selector). If there is none, wait until a matching element is attached to the DOM.
1. Ensure that matched element is a checkbox or a radio input. If not, this method throws.
1. If the element already has the right checked state, this method returns immediately.
1. Wait for [actionability](../actionability.mdx) checks on the matched element, unless [force](/api/class-page.mdx#page-set-checked-option-force) option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.mouse](/api/class-page.mdx#page-mouse) to click in the center of the element.
1. Ensure that the element is now checked or unchecked. If not, this method throws.

When all steps combined have not finished during the specified [timeout](/api/class-page.mdx#page-set-checked-option-timeout), this method throws a TimeoutError. Passing zero timeout disables this.

**Usage**

```js
await page.setChecked(selector, checked);
await page.setChecked(selector, checked, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `checked` boolean
  
  Whether to check or uncheck the checkbox.
- `options` Object *(optional)*
  - `force` boolean *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `noWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `position` Object *(optional)*
    - `x` number
      
      
    - `y` number
      
      
    A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
  - `scroll` "auto" | "none" *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)*
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `trial` boolean *(optional)*
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it.

**Returns**
- Promise<void>

---

### setInputFiles {/* #page-set-input-files */}



:::warningDiscouraged

Use locator-based [locator.setInputFiles()](/api/class-locator.mdx#locator-set-input-files) instead. Read more about [locators](../locators.mdx).

:::


Sets the value of the file input to these file paths or files. If some of the `filePaths` are relative paths, then they are resolved relative to the current working directory. For empty array, clears the selected files. For inputs with a `webkitdirectory` attribute, only a single directory path is supported.

This method expects [selector](/api/class-page.mdx#page-set-input-files-option-selector) to point to an [input element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input). However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), targets the control instead.

**Usage**

```js
await page.setInputFiles(selector, files);
await page.setInputFiles(selector, files, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `files` string | Array<string> | Object | Array<Object>
  - `name` string
    
    File name
  - `mimeType` string
    
    File type
  - `buffer` Buffer
    
    File content
- `options` Object *(optional)*
  - `noWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Promise<void>

---

### tap {/* #page-tap */}



:::warningDiscouraged

Use locator-based [locator.tap()](/api/class-locator.mdx#locator-tap) instead. Read more about [locators](../locators.mdx).

:::


This method taps an element matching [selector](/api/class-page.mdx#page-tap-option-selector) by performing the following steps:
1. Find an element matching [selector](/api/class-page.mdx#page-tap-option-selector). If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](../actionability.mdx) checks on the matched element, unless [force](/api/class-page.mdx#page-tap-option-force) option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.touchscreen](/api/class-page.mdx#page-touchscreen) to tap the center of the element, or the specified [position](/api/class-page.mdx#page-tap-option-position).

When all steps combined have not finished during the specified [timeout](/api/class-page.mdx#page-tap-option-timeout), this method throws a TimeoutError. Passing zero timeout disables this.

:::note

[page.tap()](/api/class-page.mdx#page-tap) will throw if the [hasTouch](/api/class-browser.mdx#browser-new-context-option-has-touch) option of the browser context is false.
:::

**Usage**

```js
await page.tap(selector);
await page.tap(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` Object *(optional)*
  - `force` boolean *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `modifiers` Array<"Alt" | "Control" | "ControlOrMeta" | "Meta" | "Shift"> *(optional)*
    
    Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used. "ControlOrMeta" resolves to "Control" on Windows and Linux and to "Meta" on macOS.
  - `noWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `position` Object *(optional)*
    - `x` number
      
      
    - `y` number
      
      
    A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
  - `scroll` "auto" | "none" *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `trial` boolean *(optional)* 
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it. Note that keyboard `modifiers` will be pressed regardless of `trial` to allow testing elements which are only visible when those keys are pressed.

**Returns**
- Promise<void>

---

### textContent {/* #page-text-content */}



:::warningDiscouraged

Use locator-based [locator.textContent()](/api/class-locator.mdx#locator-text-content) instead. Read more about [locators](../locators.mdx).

:::


Returns `element.textContent`.

**Usage**

```js
await page.textContent(selector);
await page.textContent(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` Object *(optional)*
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Promise<null | string>

---

### type {/* #page-type */}



:::warningDeprecated

In most cases, you should use [locator.fill()](/api/class-locator.mdx#locator-fill) instead. You only need to press keys one by one if there is special keyboard handling on the page - in this case use [locator.pressSequentially()](/api/class-locator.mdx#locator-press-sequentially).

:::


Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text. `page.type` can be used to send fine-grained keyboard events. To fill values in form fields, use [page.fill()](/api/class-page.mdx#page-fill).

To press a special key, like `Control` or `ArrowDown`, use [keyboard.press()](/api/class-keyboard.mdx#keyboard-press).

**Usage**

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `text` string
  
  A text to type into a focused element.
- `options` Object *(optional)*
  - `delay` number *(optional)*
    
    Time to wait between key presses in milliseconds. Defaults to 0.
  - `noWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Promise<void>

---

### uncheck {/* #page-uncheck */}



:::warningDiscouraged

Use locator-based [locator.uncheck()](/api/class-locator.mdx#locator-uncheck) instead. Read more about [locators](../locators.mdx).

:::


This method unchecks an element matching [selector](/api/class-page.mdx#page-uncheck-option-selector) by performing the following steps:
1. Find an element matching [selector](/api/class-page.mdx#page-uncheck-option-selector). If there is none, wait until a matching element is attached to the DOM.
1. Ensure that matched element is a checkbox or a radio input. If not, this method throws. If the element is already unchecked, this method returns immediately.
1. Wait for [actionability](../actionability.mdx) checks on the matched element, unless [force](/api/class-page.mdx#page-uncheck-option-force) option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [page.mouse](/api/class-page.mdx#page-mouse) to click in the center of the element.
1. Ensure that the element is now unchecked. If not, this method throws.

When all steps combined have not finished during the specified [timeout](/api/class-page.mdx#page-uncheck-option-timeout), this method throws a TimeoutError. Passing zero timeout disables this.

**Usage**

```js
await page.uncheck(selector);
await page.uncheck(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` Object *(optional)*
  - `force` boolean *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `noWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `position` Object *(optional)* 
    - `x` number
      
      
    - `y` number
      
      
    A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
  - `scroll` "auto" | "none" *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `trial` boolean *(optional)* 
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it.

**Returns**
- Promise<void>

---

### waitForNavigation {/* #page-wait-for-navigation */}



:::warningDeprecated

This method is inherently racy, please use [page.waitForURL()](/api/class-page.mdx#page-wait-for-url) instead.

:::


Waits for the main frame navigation and returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. In case of navigation to a different anchor or navigation due to History API usage, the navigation will resolve with `null`.

**Usage**

This resolves when the page navigates to a new URL or reloads. It is useful for when you run code which will indirectly cause the page to navigate. e.g. The click target has an `onclick` handler that triggers navigation from a `setTimeout`. Consider this example:

```js
// Start waiting for navigation before clicking. Note no await.
const navigationPromise = page.waitForNavigation();
await page.getByText('Navigate after timeout').click();
await navigationPromise;
```

:::note
Usage of the [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) to change the URL is considered a navigation.
:::

**Arguments**
- `options` Object *(optional)*
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the waiting using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the waiting will be aborted and the operation will throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `timeout` number *(optional)*
    
    Maximum operation time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `navigationTimeout` option in the config, or by using the [browserContext.setDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [page.setDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `url` string | RegExp | URLPattern | function\(URL\):boolean *(optional)*
    
    A glob pattern, regex pattern, URL pattern, or predicate receiving URL to match while waiting for the navigation. Note that if the parameter is a string without wildcard characters, the method will wait for navigation to URL that is exactly equal to the string.
  - `waitUntil` "load" | "domcontentloaded" | "networkidle" | "commit" *(optional)*
    
    When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
    * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- Promise<null | Response>

---

### waitForSelector {/* #page-wait-for-selector */}



:::warningDiscouraged

Use web assertions that assert visibility or a locator-based [locator.waitFor()](/api/class-locator.mdx#locator-wait-for) instead. Read more about [locators](../locators.mdx).

:::


Returns when element specified by selector satisfies [state](/api/class-page.mdx#page-wait-for-selector-option-state) option. Returns `null` if waiting for `hidden` or `detached`.

:::note

Playwright automatically waits for element to be ready before performing an action. Using Locator objects and web-first assertions makes the code wait-for-selector-free.
:::

Wait for the [selector](/api/class-page.mdx#page-wait-for-selector-option-selector) to satisfy [state](/api/class-page.mdx#page-wait-for-selector-option-state) option (either appear/disappear from dom, or become visible/hidden). If at the moment of calling the method [selector](/api/class-page.mdx#page-wait-for-selector-option-selector) already satisfies the condition, the method will return immediately. If the selector doesn't satisfy the condition for the [timeout](/api/class-page.mdx#page-wait-for-selector-option-timeout) milliseconds, the function will throw.

**Usage**

This method works across navigations:

```js
const { chromium } = require('playwright');  // Or 'firefox' or 'webkit'.

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const currentURL of 'https://google.com', 'https://bbc.com') {
    await page.goto(currentURL);
    const element = await page.waitForSelector('img');
    console.log('Loaded image: ' + await element.getAttribute('src'));
  }
  await browser.close();
})();
```

**Arguments**
- `selector` string
  
  A selector to query for.
- `options` Object *(optional)*
  - `signal` AbortSignal *(optional)* 
    
    Allows to cancel the operation using an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). If the signal is aborted, the operation will be aborted and throw an error. Note that providing a signal does not disable the default timeout, which can be changed using [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout); pass `timeout: 0` to disable the timeout entirely.
  - `state` "attached" | "detached" | "visible" | "hidden" *(optional)*
    
    Defaults to `'visible'`. Can be either:
    * `'attached'` - wait for element to be present in DOM.
    * `'detached'` - wait for element to not be present in DOM.
    * `'visible'` - wait for element to have non-empty bounding box and no `visibility:hidden`. Note that element without any content or with `display:none` has an empty bounding box and is not considered visible.
    * `'hidden'` - wait for element to be either detached from DOM, or have an empty bounding box or `visibility:hidden`. This is opposite to the `'visible'` option.
  - `strict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `timeout` number *(optional)*
    
    Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [browserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Promise<null | ElementHandle>

---

### waitForTimeout {/* #page-wait-for-timeout */}



:::warningDiscouraged

Never wait for timeout in production. Tests that wait for time are inherently flaky. Use Locator actions and web assertions that wait automatically.

:::


Waits for the given [timeout](/api/class-page.mdx#page-wait-for-timeout-option-timeout) in milliseconds.

Note that `page.waitForTimeout()` should only be used for debugging. Tests using the timer in production are going to be flaky. Use signals such as network events, selectors becoming visible and others instead.

**Usage**

```js
// wait for 1 second
await page.waitForTimeout(1000);
```

**Arguments**
- `timeout` number
  
  A timeout to wait for

**Returns**
- Promise<void>


APIRequest: /api/class-apirequest.mdx "APIRequest"
APIRequestContext: /api/class-apirequestcontext.mdx "APIRequestContext"
APIResponse: /api/class-apiresponse.mdx "APIResponse"
APIResponseAssertions: /api/class-apiresponseassertions.mdx "APIResponseAssertions"
Browser: /api/class-browser.mdx "Browser"
BrowserContext: /api/class-browsercontext.mdx "BrowserContext"
BrowserServer: /api/class-browserserver.mdx "BrowserServer"
BrowserType: /api/class-browsertype.mdx "BrowserType"
CDPSession: /api/class-cdpsession.mdx "CDPSession"
Clock: /api/class-clock.mdx "Clock"
ConsoleMessage: /api/class-consolemessage.mdx "ConsoleMessage"
Coverage: /api/class-coverage.mdx "Coverage"
Credentials: /api/class-credentials.mdx "Credentials"
Debugger: /api/class-debugger.mdx "Debugger"
Dialog: /api/class-dialog.mdx "Dialog"
Disposable: /api/class-disposable.mdx "Disposable"
Download: /api/class-download.mdx "Download"
ElementHandle: /api/class-elementhandle.mdx "ElementHandle"
FileChooser: /api/class-filechooser.mdx "FileChooser"
Frame: /api/class-frame.mdx "Frame"
FrameLocator: /api/class-framelocator.mdx "FrameLocator"
GenericAssertions: /api/class-genericassertions.mdx "GenericAssertions"
JSHandle: /api/class-jshandle.mdx "JSHandle"
Keyboard: /api/class-keyboard.mdx "Keyboard"
Locator: /api/class-locator.mdx "Locator"
LocatorAssertions: /api/class-locatorassertions.mdx "LocatorAssertions"
Logger: /api/class-logger.mdx "Logger"
Mouse: /api/class-mouse.mdx "Mouse"
Page: /api/class-page.mdx "Page"
PageAssertions: /api/class-pageassertions.mdx "PageAssertions"
Playwright: /api/class-playwright.mdx "Playwright"
PlaywrightAssertions: /api/class-playwrightassertions.mdx "PlaywrightAssertions"
Request: /api/class-request.mdx "Request"
Response: /api/class-response.mdx "Response"
Route: /api/class-route.mdx "Route"
Screencast: /api/class-screencast.mdx "Screencast"
Selectors: /api/class-selectors.mdx "Selectors"
SnapshotAssertions: /api/class-snapshotassertions.mdx "SnapshotAssertions"
TimeoutError: /api/class-timeouterror.mdx "TimeoutError"
Touchscreen: /api/class-touchscreen.mdx "Touchscreen"
Tracing: /api/class-tracing.mdx "Tracing"
Video: /api/class-video.mdx "Video"
WebError: /api/class-weberror.mdx "WebError"
WebSocket: /api/class-websocket.mdx "WebSocket"
WebSocketRoute: /api/class-websocketroute.mdx "WebSocketRoute"
WebStorage: /api/class-webstorage.mdx "WebStorage"
Worker: /api/class-worker.mdx "Worker"
Electron: /api/class-electron.mdx "Electron"
ElectronApplication: /api/class-electronapplication.mdx "ElectronApplication"
Android: /api/class-android.mdx "Android"
AndroidDevice: /api/class-androiddevice.mdx "AndroidDevice"
AndroidInput: /api/class-androidinput.mdx "AndroidInput"
AndroidSocket: /api/class-androidsocket.mdx "AndroidSocket"
AndroidWebView: /api/class-androidwebview.mdx "AndroidWebView"
Fixtures: /api/class-fixtures.mdx "Fixtures"
FullConfig: /api/class-fullconfig.mdx "FullConfig"
FullProject: /api/class-fullproject.mdx "FullProject"
Location: /api/class-location.mdx "Location"
Test: /api/class-test.mdx "Test"
TestConfig: /api/class-testconfig.mdx "TestConfig"
TestInfo: /api/class-testinfo.mdx "TestInfo"
TestInfoError: /api/class-testinfoerror.mdx "TestInfoError"
TestOptions: /api/class-testoptions.mdx "TestOptions"
TestProject: /api/class-testproject.mdx "TestProject"
TestStepInfo: /api/class-teststepinfo.mdx "TestStepInfo"
WorkerInfo: /api/class-workerinfo.mdx "WorkerInfo"
Reporter: /api/class-reporter.mdx "Reporter"
Suite: /api/class-suite.mdx "Suite"
TestCase: /api/class-testcase.mdx "TestCase"
TestError: /api/class-testerror.mdx "TestError"
TestResult: /api/class-testresult.mdx "TestResult"
TestRun: /api/class-testrun.mdx "TestRun"
TestStep: /api/class-teststep.mdx "TestStep"
Element: https://developer.mozilla.org/en-US/docs/Web/API/element "Element"
EvaluationArgument: /evaluating.mdx#evaluation-argument "EvaluationArgument"
Promise: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise "Promise"
iterator: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols "Iterator"
origin: https://developer.mozilla.org/en-US/docs/Glossary/Origin "Origin"
selector: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors "selector"
Serializable: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Description "Serializable"
UIEvent.detail: https://developer.mozilla.org/en-US/docs/Web/API/UIEvent/detail "UIEvent.detail"
UnixTime: https://en.wikipedia.org/wiki/Unix_time "Unix Time"
xpath: https://developer.mozilla.org/en-US/docs/Web/XPath "xpath"

AbortSignal: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal "AbortSignal"
Array: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array "Array"
boolean: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type "Boolean"
Buffer: https://nodejs.org/api/buffer.html#buffer_class_buffer "Buffer"
ChildProcess: https://nodejs.org/api/child_process.html "ChildProcess"
Date: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date "Date"
Error: https://nodejs.org/api/errors.html#errors_class_error "Error"
EventEmitter: https://nodejs.org/api/events.html#events_class_eventemitter "EventEmitter"
function: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function "Function"
FormData: https://developer.mozilla.org/en-US/docs/Web/API/FormData "FormData"
Map: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map "Map"
Metadata: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object "Object<string, any>"
null: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/null "null"
number: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type "Number"
Object: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object "Object"
Promise: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise "Promise"
Readable: https://nodejs.org/api/stream.html#stream_class_stream_readable "Readable"
ReadStream: https://nodejs.org/api/fs.html#class-fsreadstream "ReadStream"
RegExp: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp "RegExp"
string: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type "string"
void: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/undefined "void"
URL: https://nodejs.org/api/url.html "URL"
URLPattern: https://developer.mozilla.org/en-US/docs/Web/API/URLPattern "URLPattern"
URLSearchParams: https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams "URLSearchParams"

all available image tags: https://mcr.microsoft.com/en-us/product/playwright/about "all available image tags"
Microsoft Artifact Registry: https://mcr.microsoft.com/en-us/product/playwright/about "Microsoft Artifact Registry"
Dockerfile.noble: https://github.com/microsoft/playwright/blob/main/utils/docker/Dockerfile.noble "Dockerfile.noble"
