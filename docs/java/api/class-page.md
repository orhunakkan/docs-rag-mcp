# Page

> **Source:** [playwright.dev/java/docs/api/class-page](https://playwright.dev/java/docs/api/class-page)

---

Page provides methods to interact with a single tab in a Browser, or an [extension background page](https://developer.chrome.com/extensions/background_pages) in Chromium. One Browser instance might have multiple Page instances.

This example creates a page, navigates it to a URL, and then saves a screenshot:

```java
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType webkit = playwright.webkit();
      Browser browser = webkit.launch();
      BrowserContext context = browser.newContext();
      Page page = context.newPage();
      page.navigate("https://example.com");
      page.screenshot(new Page.ScreenshotOptions().setPath(Paths.get("screenshot.png")));
      browser.close();
    }
  }
}
```

The Page class emits various events (described below) which can be handled using any of Node's native [`EventEmitter`](https://nodejs.org/api/events.html#events_class_eventemitter) methods, such as `on`, `once` or `removeListener`.

This example logs a message for a single page `load` event:

```java
page.onLoad(p -> System.out.println("Page loaded!"));
```

To unsubscribe from events use the `removeListener` method:

```java
Consumer<Request> logRequest = interceptedRequest -> {
  System.out.println("A request was made: " + interceptedRequest.url());
};
page.onRequest(logRequest);
// Sometime later...
page.offRequest(logRequest);
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

```java
// In your playwright script, assuming the preload.js file is in same directory
page.addInitScript(Paths.get("./preload.js"));
```

:::note
The order of evaluation of multiple scripts installed via [BrowserContext.addInitScript()](/api/class-browsercontext.mdx#browser-context-add-init-script) and [Page.addInitScript()](/api/class-page.mdx#page-add-init-script) is not defined.
:::

**Arguments**
- `script` String | Path
  
  Script to be evaluated in all pages in the browser context.

**Returns**
- Disposable

---

### addLocatorHandler {/* #page-add-locator-handler */}



When testing a web page, sometimes unexpected overlays like a "Sign up" dialog appear and block actions you want to automate, e.g. clicking a button. These overlays don't always show up in the same way or at the same time, making them tricky to handle in automated tests.

This method lets you set up a special function, called a handler, that activates when it detects that overlay is visible. The handler's job is to remove the overlay, allowing your test to continue as if the overlay wasn't there.

Things to keep in mind:
* When an overlay is shown predictably, we recommend explicitly waiting for it in your test and dismissing it as a part of your normal test flow, instead of using [Page.addLocatorHandler()](/api/class-page.mdx#page-add-locator-handler).
* Playwright checks for the overlay every time before executing or retrying an action that requires an [actionability check](../actionability.mdx), or before performing an auto-waiting assertion check. When overlay is visible, Playwright calls the handler first, and then proceeds with the action/assertion. Note that the handler is only called when you perform an action/assertion - if the overlay becomes visible but you don't perform any actions, the handler will not be triggered.
* After executing the handler, Playwright will ensure that overlay that triggered the handler is not visible anymore. You can opt-out of this behavior with [setNoWaitAfter](/api/class-page.mdx#page-add-locator-handler-option-no-wait-after).
* The execution time of the handler counts towards the timeout of the action/assertion that executed the handler. If your handler takes too long, it might cause timeouts.
* You can register multiple handlers. However, only a single handler will be running at a time. Make sure the actions within a handler don't depend on another handler.

:::warning

Running the handler will alter your page state mid-test. For example it will change the currently focused element and move the mouse. Make sure that actions that run after the handler are self-contained and do not rely on the focus and mouse state being unchanged.

For example, consider a test that calls [Locator.focus()](/api/class-locator.mdx#locator-focus) followed by [Keyboard.press()](/api/class-keyboard.mdx#keyboard-press). If your handler clicks a button between these two actions, the focused element most likely will be wrong, and key press will happen on the unexpected element. Use [Locator.press()](/api/class-locator.mdx#locator-press) instead to avoid this problem.

Another example is a series of mouse actions, where [Mouse.move()](/api/class-mouse.mdx#mouse-move) is followed by [Mouse.down()](/api/class-mouse.mdx#mouse-down). Again, when the handler runs between these two actions, the mouse position will be wrong during the mouse down. Prefer self-contained actions like [Locator.click()](/api/class-locator.mdx#locator-click) that do not rely on the state being unchanged by a handler.
:::

**Usage**

An example that closes a "Sign up to the newsletter" dialog when it appears:

```java
// Setup the handler.
page.addLocatorHandler(page.getByText("Sign up to the newsletter"), () -> {
  page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("No thanks")).click();
});

// Write the test as usual.
page.navigate("https://example.com");
page.getByRole("button", Page.GetByRoleOptions().setName("Start here")).click();
```

An example that skips the "Confirm your security details" page when it is shown:

```java
// Setup the handler.
page.addLocatorHandler(page.getByText("Confirm your security details"), () -> {
  page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Remind me later")).click();
});

// Write the test as usual.
page.navigate("https://example.com");
page.getByRole("button", Page.GetByRoleOptions().setName("Start here")).click();
```

An example with a custom callback on every actionability check. It uses a `<body>` locator that is always visible, so the handler is called before every actionability check. It is important to specify [setNoWaitAfter](/api/class-page.mdx#page-add-locator-handler-option-no-wait-after), because the handler does not hide the `<body>` element.

```java
// Setup the handler.
page.addLocatorHandler(page.locator("body"), () -> {
  page.evaluate("window.removeObstructionsForTestIfNeeded()");
}, new Page.AddLocatorHandlerOptions().setNoWaitAfter(true));

// Write the test as usual.
page.navigate("https://example.com");
page.getByRole("button", Page.GetByRoleOptions().setName("Start here")).click();
```

Handler takes the original locator as an argument. You can also automatically remove the handler after a number of invocations by setting [setTimes](/api/class-page.mdx#page-add-locator-handler-option-times):

```java
page.addLocatorHandler(page.getByLabel("Close"), locator -> {
  locator.click();
}, new Page.AddLocatorHandlerOptions().setTimes(1));
```

**Arguments**
- `locator` Locator
  
  Locator that triggers the handler.
- `handler` Consumer<Locator>
  
  Function that should be run once [locator](/api/class-page.mdx#page-add-locator-handler-option-locator) appears. This function should get rid of the element that blocks actions like click.
- `options` `Page.AddLocatorHandlerOptions` *(optional)*
  - `setNoWaitAfter` boolean *(optional)* 
    
    By default, after calling the handler Playwright will wait until the overlay becomes hidden, and only then Playwright will continue with the action/assertion that triggered the handler. This option allows to opt-out of this behavior, so that overlay can stay visible after the handler has run.
  - `setTimes` int *(optional)* 
    
    Specifies the maximum number of times this handler should be called. Unlimited by default.

**Returns**
- void

---

### addScriptTag {/* #page-add-script-tag */}



Adds a `<script>` tag into the page with the desired url or content. Returns the added tag when the script's onload fires or when the script content was injected into frame.

**Usage**

```java
Page.addScriptTag();
Page.addScriptTag(options);
```

**Arguments**
- `options` `Page.AddScriptTagOptions` *(optional)*
  - `setContent` String *(optional)*
    
    Raw JavaScript content to be injected into frame.
  - `setPath` Path *(optional)*
    
    Path to the JavaScript file to be injected into frame. If `path` is a relative path, then it is resolved relative to the current working directory.
  - `setType` String *(optional)*
    
    Script type. Use 'module' in order to load a JavaScript ES6 module. See [script](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script) for more details.
  - `setUrl` String *(optional)*
    
    URL of a script to be added.

**Returns**
- ElementHandle

---

### addStyleTag {/* #page-add-style-tag */}



Adds a `<link rel="stylesheet">` tag into the page with the desired url or a `<style type="text/css">` tag with the content. Returns the added tag when the stylesheet's onload fires or when the CSS content was injected into frame.

**Usage**

```java
Page.addStyleTag();
Page.addStyleTag(options);
```

**Arguments**
- `options` `Page.AddStyleTagOptions` *(optional)*
  - `setContent` String *(optional)*
    
    Raw CSS content to be injected into frame.
  - `setPath` Path *(optional)*
    
    Path to the CSS file to be injected into frame. If `path` is a relative path, then it is resolved relative to the current working directory.
  - `setUrl` String *(optional)*
    
    URL of the `<link>` tag.

**Returns**
- ElementHandle

---

### ariaSnapshot {/* #page-aria-snapshot */}



Captures the aria snapshot of the page. Read more about [aria snapshots](../aria-snapshots.mdx).

**Usage**

```java
Page.ariaSnapshot();
Page.ariaSnapshot(options);
```

**Arguments**
- `options` `Page.AriaSnapshotOptions` *(optional)*
  - `setBoxes` boolean *(optional)* 
    
    When `true`, appends each element's bounding box as `box=x,y,width,height` to the snapshot. Coordinates are relative to the viewport, in CSS pixels, as returned by [`Element.getBoundingClientRect()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect). Defaults to `false`.
  - `setDepth` int *(optional)*
    
    When specified, limits the depth of the snapshot.
  - `setMode` `enum AriaSnapshotMode { AI, DEFAULT }` *(optional)*
    
    When set to `"ai"`, returns a snapshot optimized for AI consumption: including element references like `ref=e2` and snapshots of `<iframe>`s. Defaults to `"default"`.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- String

---

### bringToFront {/* #page-bring-to-front */}



Brings page to front (activates tab).

**Usage**

```java
Page.bringToFront();
```

**Returns**
- void

---

### cancelPickLocator {/* #page-cancel-pick-locator */}



Cancels an ongoing [Page.pickLocator()](/api/class-page.mdx#page-pick-locator) call by deactivating pick locator mode. If no pick locator mode is active, this method is a no-op.

**Usage**

```java
Page.cancelPickLocator();
```

**Returns**
- void

---

### clearConsoleMessages {/* #page-clear-console-messages */}



Clears all stored console messages from this page. Subsequent calls to [Page.consoleMessages()](/api/class-page.mdx#page-console-messages) will only return messages logged after the clear.

**Usage**

```java
Page.clearConsoleMessages();
```

**Returns**
- void

---

### clearPageErrors {/* #page-clear-page-errors */}



Clears all stored page errors from this page. Subsequent calls to [Page.pageErrors()](/api/class-page.mdx#page-page-errors) will only return errors thrown after the clear.

**Usage**

```java
Page.clearPageErrors();
```

**Returns**
- void

---

### close {/* #page-close */}



If [setRunBeforeUnload](/api/class-page.mdx#page-close-option-run-before-unload) is `false`, does not run any unload handlers and waits for the page to be closed. If [setRunBeforeUnload](/api/class-page.mdx#page-close-option-run-before-unload) is `true` the method will run unload handlers, but will **not** wait for the page to close.

By default, `page.close()` **does not** run `beforeunload` handlers.

:::note

if [setRunBeforeUnload](/api/class-page.mdx#page-close-option-run-before-unload) is passed as true, a `beforeunload` dialog might be summoned and should be handled manually via [Page.onDialog(handler)](/api/class-page.mdx#page-event-dialog) event.
:::

**Usage**

```java
Page.close();
Page.close(options);
```

**Arguments**
- `options` `Page.CloseOptions` *(optional)*
  - `setReason` String *(optional)* 
    
    The reason to be reported to the operations interrupted by the page closure.
  - `setRunBeforeUnload` boolean *(optional)*
    
    Defaults to `false`. Whether to run the [before unload](https://developer.mozilla.org/en-US/docs/Web/Events/beforeunload) page handlers.

**Returns**
- void

---

### consoleMessages {/* #page-console-messages */}



Returns up to (currently) 200 last console messages from this page. See [Page.onConsoleMessage(handler)](/api/class-page.mdx#page-event-console) for more details.

**Usage**

```java
Page.consoleMessages();
Page.consoleMessages(options);
```

**Arguments**
- `options` `Page.ConsoleMessagesOptions` *(optional)*
  - `setFilter` `enum ConsoleMessagesFilter { ALL, SINCE_NAVIGATION }` *(optional)* 
    
    Controls which messages are returned:

**Returns**
- List<ConsoleMessage>

---

### content {/* #page-content */}



Gets the full HTML contents of the page, including the doctype.

**Usage**

```java
Page.content();
```

**Returns**
- String

---

### context {/* #page-context */}



Get the browser context that the page belongs to.

**Usage**

```java
Page.context();
```

**Returns**
- BrowserContext

---

### dragAndDrop {/* #page-drag-and-drop */}



This method drags the source element to the target element. It will first move to the source element, perform a `mousedown`, then move to the target element and perform a `mouseup`.

**Usage**

```java
page.dragAndDrop("#source", "#target");
// or specify exact positions relative to the top-left corners of the elements:
page.dragAndDrop("#source", "#target", new Page.DragAndDropOptions()
  .setSourcePosition(34, 7).setTargetPosition(10, 20));
```

**Arguments**
- `source` String
  
  A selector to search for an element to drag. If there are multiple elements satisfying the selector, the first will be used.
- `target` String
  
  A selector to search for an element to drop onto. If there are multiple elements satisfying the selector, the first will be used.
- `options` `Page.DragAndDropOptions` *(optional)*
  - `setForce` boolean *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `setNoWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `setScroll` `enum ScrollMode { AUTO, NONE }` *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `setSourcePosition` SourcePosition *(optional)* 
    - `setX` double
      
      
    - `setY` double
      
      
    Clicks on the source element at this point relative to the top-left corner of the element's padding box. If not specified, some visible point of the element is used.
  - `setSteps` int *(optional)* 
    
    Defaults to 1. Sends `n` interpolated `mousemove` events to represent travel between the `mousedown` and `mouseup` of the drag. When set to 1, emits a single `mousemove` event at the destination location.
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTargetPosition` TargetPosition *(optional)* 
    - `setX` double
      
      
    - `setY` double
      
      
    Drops on the target element at this point relative to the top-left corner of the element's padding box. If not specified, some visible point of the element is used.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `setTrial` boolean *(optional)*
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it.

**Returns**
- void

---

### emulateMedia {/* #page-emulate-media */}



This method changes the `CSS media type` through the `media` argument, and/or the `'prefers-colors-scheme'` media feature, using the `colorScheme` argument.

**Usage**

```java
page.evaluate("() => matchMedia('screen').matches");
// → true
page.evaluate("() => matchMedia('print').matches");
// → false

page.emulateMedia(new Page.EmulateMediaOptions().setMedia(Media.PRINT));
page.evaluate("() => matchMedia('screen').matches");
// → false
page.evaluate("() => matchMedia('print').matches");
// → true

page.emulateMedia(new Page.EmulateMediaOptions());
page.evaluate("() => matchMedia('screen').matches");
// → true
page.evaluate("() => matchMedia('print').matches");
// → false
```

```java
page.emulateMedia(new Page.EmulateMediaOptions().setColorScheme(ColorScheme.DARK));
page.evaluate("() => matchMedia('(prefers-color-scheme: dark)').matches");
// → true
page.evaluate("() => matchMedia('(prefers-color-scheme: light)').matches");
// → false
```

**Arguments**
- `options` `Page.EmulateMediaOptions` *(optional)*
  - `setColorScheme` null | `enum ColorScheme { LIGHT, DARK, NO_PREFERENCE }` *(optional)* 
    
    Emulates [prefers-colors-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme) media feature, supported values are `'light'` and `'dark'`. Passing `null` disables color scheme emulation. `'no-preference'` is deprecated.
  - `setContrast` null | `enum Contrast { NO_PREFERENCE, MORE }` *(optional)* 
    
    Emulates `'prefers-contrast'` media feature, supported values are `'no-preference'`, `'more'`. Passing `null` disables contrast emulation.
  - `setForcedColors` null | `enum ForcedColors { ACTIVE, NONE }` *(optional)* 
    
    Emulates `'forced-colors'` media feature, supported values are `'active'` and `'none'`. Passing `null` disables forced colors emulation.
  - `setMedia` null | `enum Media { SCREEN, PRINT }` *(optional)* 
    
    Changes the CSS media type of the page. The only allowed values are `'screen'`, `'print'` and `null`. Passing `null` disables CSS media emulation.
  - `setReducedMotion` null | `enum ReducedMotion { REDUCE, NO_PREFERENCE }` *(optional)* 
    
    Emulates `'prefers-reduced-motion'` media feature, supported values are `'reduce'`, `'no-preference'`. Passing `null` disables reduced motion emulation.

**Returns**
- void

---

### evaluate {/* #page-evaluate */}



Returns the value of the [expression](/api/class-page.mdx#page-evaluate-option-expression) invocation.

If the function passed to the [Page.evaluate()](/api/class-page.mdx#page-evaluate) returns a Promise, then [Page.evaluate()](/api/class-page.mdx#page-evaluate) would wait for the promise to resolve and return its value.

If the function passed to the [Page.evaluate()](/api/class-page.mdx#page-evaluate) returns a non-Serializable value, then [Page.evaluate()](/api/class-page.mdx#page-evaluate) resolves to `undefined`. Playwright also supports transferring some additional values that are not serializable by `JSON`: `-0`, `NaN`, `Infinity`, `-Infinity`.

**Usage**

Passing argument to [expression](/api/class-page.mdx#page-evaluate-option-expression):

```java
Object result = page.evaluate("(x, y) => {\n" +
  "  return Promise.resolve(x * y);\n" +
  "}", Arrays.asList(7, 8));
System.out.println(result); // prints "56"
```

A string can also be passed in instead of a function:

```java
System.out.println(page.evaluate("1 + 2")); // prints "3"
```

ElementHandle instances can be passed as an argument to the [Page.evaluate()](/api/class-page.mdx#page-evaluate):

```java
ElementHandle bodyHandle = page.evaluateHandle("document.body");
String html = (String) page.evaluate("(body, suffix) => body.innerHTML + suffix", Arrays.asList(bodyHandle, "hello"));
bodyHandle.dispose();
```

**Arguments**
- `expression` String
  
  JavaScript expression to be evaluated in the browser context. If the expression evaluates to a function, the function is automatically invoked.
- `arg` EvaluationArgument *(optional)*
  
  Optional argument to pass to [expression](/api/class-page.mdx#page-evaluate-option-expression).

**Returns**
- Object

---

### evaluateHandle {/* #page-evaluate-handle */}



Returns the value of the [expression](/api/class-page.mdx#page-evaluate-handle-option-expression) invocation as a JSHandle.

The only difference between [Page.evaluate()](/api/class-page.mdx#page-evaluate) and [Page.evaluateHandle()](/api/class-page.mdx#page-evaluate-handle) is that [Page.evaluateHandle()](/api/class-page.mdx#page-evaluate-handle) returns JSHandle.

If the function passed to the [Page.evaluateHandle()](/api/class-page.mdx#page-evaluate-handle) returns a Promise, then [Page.evaluateHandle()](/api/class-page.mdx#page-evaluate-handle) would wait for the promise to resolve and return its value.

**Usage**

```java
// Handle for the window object.
JSHandle aWindowHandle = page.evaluateHandle("() => Promise.resolve(window)");
```

A string can also be passed in instead of a function:

```java
JSHandle aHandle = page.evaluateHandle("document"); // Handle for the "document".
```

JSHandle instances can be passed as an argument to the [Page.evaluateHandle()](/api/class-page.mdx#page-evaluate-handle):

```java
JSHandle aHandle = page.evaluateHandle("() => document.body");
JSHandle resultHandle = page.evaluateHandle("(body, suffix) => body.innerHTML + suffix", Arrays.asList(aHandle, "hello"));
System.out.println(resultHandle.jsonValue());
resultHandle.dispose();
```

**Arguments**
- `expression` String
  
  JavaScript expression to be evaluated in the browser context. If the expression evaluates to a function, the function is automatically invoked.
- `arg` EvaluationArgument *(optional)*
  
  Optional argument to pass to [expression](/api/class-page.mdx#page-evaluate-handle-option-expression).

**Returns**
- JSHandle

---

### exposeBinding {/* #page-expose-binding */}



The method adds a function called [name](/api/class-page.mdx#page-expose-binding-option-name) on the `window` object of every frame in this page. When called, the function executes [callback](/api/class-page.mdx#page-expose-binding-option-callback) and returns a Promise which resolves to the return value of [callback](/api/class-page.mdx#page-expose-binding-option-callback). If the [callback](/api/class-page.mdx#page-expose-binding-option-callback) returns a Promise, it will be awaited.

The first argument of the [callback](/api/class-page.mdx#page-expose-binding-option-callback) function contains information about the caller: `{ browserContext: BrowserContext, page: Page, frame: Frame }`.

See [BrowserContext.exposeBinding()](/api/class-browsercontext.mdx#browser-context-expose-binding) for the context-wide version.

:::note

Functions installed via [Page.exposeBinding()](/api/class-page.mdx#page-expose-binding) survive navigations.
:::

**Usage**

An example of exposing page URL to all frames in a page:

```java
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType webkit = playwright.webkit();
      Browser browser = webkit.launch(new BrowserType.LaunchOptions().setHeadless(false));
      BrowserContext context = browser.newContext();
      Page page = context.newPage();
      page.exposeBinding("pageURL", (source, args) -> source.page().url());
      page.setContent("<script>\n" +
        "  async function onClick() {\n" +
        "    document.querySelector('div').textContent = await window.pageURL();\n" +
        "  }\n" +
        "</script>\n" +
        "<button onclick=\"onClick()\">Click me</button>\n" +
        "<div></div>");
      page.click("button");
    }
  }
}
```

**Arguments**
- `name` String
  
  Name of the function on the window object.
- `callback` `BindingCallback`
  
  Callback function that will be called in the Playwright's context.

**Returns**
- Disposable

---

### exposeFunction {/* #page-expose-function */}



The method adds a function called [name](/api/class-page.mdx#page-expose-function-option-name) on the `window` object of every frame in the page. When called, the function executes [callback](/api/class-page.mdx#page-expose-function-option-callback) and returns a Promise which resolves to the return value of [callback](/api/class-page.mdx#page-expose-function-option-callback).

If the [callback](/api/class-page.mdx#page-expose-function-option-callback) returns a Promise, it will be awaited.

See [BrowserContext.exposeFunction()](/api/class-browsercontext.mdx#browser-context-expose-function) for context-wide exposed function.

:::note

Functions installed via [Page.exposeFunction()](/api/class-page.mdx#page-expose-function) survive navigations.
:::

**Usage**

An example of adding a `sha256` function to the page:

```java
import com.microsoft.playwright.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType webkit = playwright.webkit();
      Browser browser = webkit.launch(new BrowserType.LaunchOptions().setHeadless(false));
      Page page = browser.newPage();
      page.exposeFunction("sha256", args -> {
        try {
          String text = (String) args0;
          MessageDigest crypto = MessageDigest.getInstance("SHA-256");
          byte[] token = crypto.digest(text.getBytes(StandardCharsets.UTF_8));
          return Base64.getEncoder().encodeToString(token);
        } catch (NoSuchAlgorithmException e) {
          return null;
        }
      });
      page.setContent(
        "<script>\n" +
        "  async function onClick() {\n" +
        "    document.querySelector('div').textContent = await window.sha256('PLAYWRIGHT');\n" +
        "  }\n" +
        "</script>\n" +
        "<button onclick=\"onClick()\">Click me</button>\n" +
        "<div></div>"
      );
      page.click("button");
    }
  }
}
```

**Arguments**
- `name` String
  
  Name of the function on the window object
- `callback` `FunctionCallback`
  
  Callback function which will be called in Playwright's context.

**Returns**
- Disposable

---

### frame {/* #page-frame */}



Returns frame matching the specified criteria. Either `name` or `url` must be specified.

**Usage**

```java
Frame frame = page.frame("frame-name");
```

```java
Frame frame = page.frameByUrl(Pattern.compile(".*domain.*"));
```

**Arguments**
- `name` String 
  
  Frame name specified in the `iframe`'s `name` attribute.

**Returns**
- null | Frame

---

### frameByUrl {/* #page-frame-by-url */}



Returns frame with matching URL.

**Usage**

```java
Page.frameByUrl(url);
```

**Arguments**
- `url` String | Pattern | Predicate<String>
  
  A glob pattern, regex pattern or predicate receiving frame's `url` as a URL object.

**Returns**
- null | Frame

---

### frameLocator {/* #page-frame-locator */}



When working with iframes, you can create a frame locator that will enter the iframe and allow selecting elements in that iframe.

**Usage**

Following snippet locates element with text "Submit" in the iframe with id `my-frame`, like `<iframe id="my-frame">`:

```java
Locator locator = page.frameLocator("#my-iframe").getByText("Submit");
locator.click();
```

**Arguments**
- `selector` String
  
  A selector to use when resolving DOM element.

**Returns**
- FrameLocator

---

### frames {/* #page-frames */}



An array of all frames attached to the page.

**Usage**

```java
Page.frames();
```

**Returns**
- List<Frame>

---

### getByAltText {/* #page-get-by-alt-text */}



Allows locating elements by their alt text.

**Usage**

For example, this method will find the image by alt text "Playwright logo":

```html
<img alt='Playwright logo'>
```

```java
page.getByAltText("Playwright logo").click();
```

**Arguments**
- `text` String | Pattern
  
  Text to locate the element for.
- `options` `Page.GetByAltTextOptions` *(optional)*
  - `setExact` boolean *(optional)*
    
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

```java
page.getByLabel("Username").fill("john");
page.getByLabel("Password").fill("secret");
```

**Arguments**
- `text` String | Pattern
  
  Text to locate the element for.
- `options` `Page.GetByLabelOptions` *(optional)*
  - `setExact` boolean *(optional)*
    
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

```java
page.getByPlaceholder("name@example.com").fill("playwright@microsoft.com");
```

**Arguments**
- `text` String | Pattern
  
  Text to locate the element for.
- `options` `Page.GetByPlaceholderOptions` *(optional)*
  - `setExact` boolean *(optional)*
    
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

```java
assertThat(page
    .getByRole(AriaRole.HEADING,
               new Page.GetByRoleOptions().setName("Sign up")))
    .isVisible();

page.getByRole(AriaRole.CHECKBOX,
               new Page.GetByRoleOptions().setName("Subscribe"))
    .check();

page.getByRole(AriaRole.BUTTON,
               new Page.GetByRoleOptions().setName(
                   Pattern.compile("submit", Pattern.CASE_INSENSITIVE)))
    .click();
```

**Arguments**
- `role` `enum AriaRole { ALERT, ALERTDIALOG, APPLICATION, ARTICLE, BANNER, BLOCKQUOTE, BUTTON, CAPTION, CELL, CHECKBOX, CODE, COLUMNHEADER, COMBOBOX, COMPLEMENTARY, CONTENTINFO, DEFINITION, DELETION, DIALOG, DIRECTORY, DOCUMENT, EMPHASIS, FEED, FIGURE, FORM, GENERIC, GRID, GRIDCELL, GROUP, HEADING, IMG, INSERTION, LINK, LIST, LISTBOX, LISTITEM, LOG, MAIN, MARQUEE, MATH, METER, MENU, MENUBAR, MENUITEM, MENUITEMCHECKBOX, MENUITEMRADIO, NAVIGATION, NONE, NOTE, OPTION, PARAGRAPH, PRESENTATION, PROGRESSBAR, RADIO, RADIOGROUP, REGION, ROW, ROWGROUP, ROWHEADER, SCROLLBAR, SEARCH, SEARCHBOX, SEPARATOR, SLIDER, SPINBUTTON, STATUS, STRONG, SUBSCRIPT, SUPERSCRIPT, SWITCH, TAB, TABLE, TABLIST, TABPANEL, TERM, TEXTBOX, TIME, TIMER, TOOLBAR, TOOLTIP, TREE, TREEGRID, TREEITEM }`
  
  Required aria role.
- `options` `Page.GetByRoleOptions` *(optional)*
  - `setChecked` boolean *(optional)*
    
    An attribute that is usually set by `aria-checked` or native `<input type=checkbox>` controls.
    
    Learn more about [`aria-checked`](https://www.w3.org/TR/wai-aria-1.2/#aria-checked).
  - `setDescription` String | Pattern *(optional)* 
    
    Option to match the [accessible description](https://w3c.github.io/accname/#dfn-accessible-description). By default, matching is case-insensitive and searches for a substring, use [setExact](/api/class-page.mdx#page-get-by-role-option-exact) to control this behavior.
    
    Learn more about [accessible description](https://w3c.github.io/accname/#dfn-accessible-description).
  - `setDisabled` boolean *(optional)*
    
    An attribute that is usually set by `aria-disabled` or `disabled`.
    
    :::note
    
    Unlike most other attributes, `disabled` is inherited through the DOM hierarchy. Learn more about [`aria-disabled`](https://www.w3.org/TR/wai-aria-1.2/#aria-disabled).
    :::
    
  - `setExact` boolean *(optional)* 
    
    Whether [setName](/api/class-page.mdx#page-get-by-role-option-name) and [setDescription](/api/class-page.mdx#page-get-by-role-option-description) are matched exactly: case-sensitive and whole-string. Defaults to false. Ignored when the value is a regular expression. Note that exact match still trims whitespace.
  - `setExpanded` boolean *(optional)*
    
    An attribute that is usually set by `aria-expanded`.
    
    Learn more about [`aria-expanded`](https://www.w3.org/TR/wai-aria-1.2/#aria-expanded).
  - `setIncludeHidden` boolean *(optional)*
    
    Option that controls whether hidden elements are matched. By default, only non-hidden elements, as [defined by ARIA](https://www.w3.org/TR/wai-aria-1.2/#tree_exclusion), are matched by role selector.
    
    Learn more about [`aria-hidden`](https://www.w3.org/TR/wai-aria-1.2/#aria-hidden).
  - `setLevel` int *(optional)*
    
    A number attribute that is usually present for roles `heading`, `listitem`, `row`, `treeitem`, with default values for `<h1>-<h6>` elements.
    
    Learn more about [`aria-level`](https://www.w3.org/TR/wai-aria-1.2/#aria-level).
  - `setName` String | Pattern *(optional)*
    
    Option to match the [accessible name](https://w3c.github.io/accname/#dfn-accessible-name). By default, matching is case-insensitive and searches for a substring, use [setExact](/api/class-page.mdx#page-get-by-role-option-exact) to control this behavior.
    
    Learn more about [accessible name](https://w3c.github.io/accname/#dfn-accessible-name).
  - `setPressed` boolean *(optional)*
    
    An attribute that is usually set by `aria-pressed`.
    
    Learn more about [`aria-pressed`](https://www.w3.org/TR/wai-aria-1.2/#aria-pressed).
  - `setSelected` boolean *(optional)*
    
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

```java
page.getByTestId("directions").click();
```

**Arguments**
- `testId` String | Pattern
  
  Id to locate the element by.

**Returns**
- Locator

**Details**

By default, the `data-testid` attribute is used as a test id. Use [Selectors.setTestIdAttribute()](/api/class-selectors.mdx#selectors-set-test-id-attribute) to configure a different test id attribute if necessary.

---

### getByText {/* #page-get-by-text */}



Allows locating elements that contain given text.

See also [Locator.filter()](/api/class-locator.mdx#locator-filter) that allows to match by another criteria, like an accessible role, and then filter by the text content.

**Usage**

Consider the following DOM structure:

```html
<div>Hello <span>world</span></div>
<div>Hello</div>
```

You can locate by text substring, exact string, or a regular expression:

```java
// Matches <span>
page.getByText("world");

// Matches first <div>
page.getByText("Hello world");

// Matches second <div>
page.getByText("Hello", new Page.GetByTextOptions().setExact(true));

// Matches both <div>s
page.getByText(Pattern.compile("Hello"));

// Matches second <div>
page.getByText(Pattern.compile("^hello$", Pattern.CASE_INSENSITIVE));
```

**Arguments**
- `text` String | Pattern
  
  Text to locate the element for.
- `options` `Page.GetByTextOptions` *(optional)*
  - `setExact` boolean *(optional)*
    
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

```java
assertThat(page.getByTitle("Issues count")).hasText("25 issues");
```

**Arguments**
- `text` String | Pattern
  
  Text to locate the element for.
- `options` `Page.GetByTitleOptions` *(optional)*
  - `setExact` boolean *(optional)*
    
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

```java
Page.goBack();
Page.goBack(options);
```

**Arguments**
- `options` `Page.GoBackOptions` *(optional)*
  - `setTimeout` double *(optional)*
    
    Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [Page.setDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `setWaitUntil` `enum WaitUntilState { LOAD, DOMCONTENTLOADED, NETWORKIDLE, COMMIT }` *(optional)*
    
    When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
    * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- null | Response

---

### goForward {/* #page-go-forward */}



Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. If cannot go forward, returns `null`.

Navigate to the next page in history.

:::warning

**Testing Back/Forward Cache (BFCache) is not supported.**  By default, Playwright disables the Back/Forward Cache across all browsers. Even if explicitly enabled, Playwright's internal state relies on network-level navigation events. Because BFCache restores unfreeze the DOM without firing these events, using `page.goBack()` or `page.goForward()` to trigger a BFCache restore will result in timeouts and a desynchronized `Page` state.
:::

**Usage**

```java
Page.goForward();
Page.goForward(options);
```

**Arguments**
- `options` `Page.GoForwardOptions` *(optional)*
  - `setTimeout` double *(optional)*
    
    Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [Page.setDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `setWaitUntil` `enum WaitUntilState { LOAD, DOMCONTENTLOADED, NETWORKIDLE, COMMIT }` *(optional)*
    
    When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
    * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- null | Response

---

### hideHighlight {/* #page-hide-highlight */}



Hide all locator highlight overlays previously added by [Locator.highlight()](/api/class-locator.mdx#locator-highlight) on this page.

**Usage**

```java
Page.hideHighlight();
```

**Returns**
- void

---

### isClosed {/* #page-is-closed */}



Indicates that the page has been closed.

**Usage**

```java
Page.isClosed();
```

**Returns**
- boolean

---

### locator {/* #page-locator */}



The method returns an element locator that can be used to perform actions on this page / frame. Locator is resolved to the element immediately before performing an action, so a series of actions on the same locator can in fact be performed on different DOM elements. That would happen if the DOM structure between those actions has changed.

[Learn more about locators](../locators.mdx).

**Usage**

```java
Page.locator(selector);
Page.locator(selector, options);
```

**Arguments**
- `selector` String
  
  A selector to use when resolving DOM element.
- `options` `Page.LocatorOptions` *(optional)*
  - `setHas` Locator *(optional)*
    
    Narrows down the results of the method to those which contain elements matching this relative locator. For example, `article` that has `text=Playwright` matches `<article><div>Playwright</div></article>`.
    
    Inner locator **must be relative** to the outer locator and is queried starting with the outer locator match, not the document root. For example, you can find `content` that has `div` in `<article><content><div>Playwright</div></content></article>`. However, looking for `content` that has `article div` will fail, because the inner locator must be relative and should not use any elements outside the `content`.
    
    Note that outer and inner locators must belong to the same frame. Inner locator must not contain FrameLocators.
  - `setHasNot` Locator *(optional)* 
    
    Matches elements that do not contain an element that matches an inner locator. Inner locator is queried against the outer one. For example, `article` that does not have `div` matches `<article><span>Playwright</span></article>`.
    
    Note that outer and inner locators must belong to the same frame. Inner locator must not contain FrameLocators.
  - `setHasNotText` String | Pattern *(optional)* 
    
    Matches elements that do not contain specified text somewhere inside, possibly in a child or a descendant element. When passed a string, matching is case-insensitive and searches for a substring.
  - `setHasText` String | Pattern *(optional)*
    
    Matches elements containing specified text somewhere inside, possibly in a child or a descendant element. When passed a string, matching is case-insensitive and searches for a substring. For example, `"Playwright"` matches `<article><div>Playwright</div></article>`.

**Returns**
- Locator

---

### mainFrame {/* #page-main-frame */}



The page's main frame. Page is guaranteed to have a main frame which persists during navigations.

**Usage**

```java
Page.mainFrame();
```

**Returns**
- Frame

---

### navigate {/* #page-goto */}



Returns the main resource response. In case of multiple redirects, the navigation will resolve with the first non-redirect response.

The method will throw an error if:
* there's an SSL error (e.g. in case of self-signed certificates).
* target URL is invalid.
* the [setTimeout](/api/class-page.mdx#page-goto-option-timeout) is exceeded during navigation.
* the remote server does not respond or is unreachable.
* the main resource failed to load.

The method will not throw an error when any valid HTTP status code is returned by the remote server, including 404 "Not Found" and 500 "Internal Server Error".  The status code for such responses can be retrieved by calling [Response.status()](/api/class-response.mdx#response-status).

:::note

The method either throws an error or returns a main resource response. The only exceptions are navigation to `about:blank` or navigation to the same URL with a different hash, which would succeed and return `null`.
:::

:::note
Headless mode doesn't support navigation to a PDF document. See the [upstream issue](https://bugs.chromium.org/p/chromium/issues/detail?id=761295).
:::

**Usage**

```java
Page.navigate(url);
Page.navigate(url, options);
```

**Arguments**
- `url` String
  
  URL to navigate page to. The url should include scheme, e.g. `https://`. When a [setBaseURL](/api/class-browser.mdx#browser-new-context-option-base-url) via the context options was provided and the passed URL is a path, it gets merged via the [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor.
- `options` `Page.NavigateOptions` *(optional)*
  - `setReferer` String *(optional)*
    
    Referer header value. If provided it will take preference over the referer header value set by [Page.setExtraHTTPHeaders()](/api/class-page.mdx#page-set-extra-http-headers).
  - `setTimeout` double *(optional)*
    
    Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [Page.setDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `setWaitUntil` `enum WaitUntilState { LOAD, DOMCONTENTLOADED, NETWORKIDLE, COMMIT }` *(optional)*
    
    When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
    * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- null | Response

---

### onceDialog {/* #page-once-dialog */}



Adds one-off Dialog handler. The handler will be removed immediately after next Dialog is created.

```java
page.onceDialog(dialog -> {
  dialog.accept("foo");
});

// prints 'foo'
System.out.println(page.evaluate("prompt('Enter string:')"));

// prints 'null' as the dialog will be auto-dismissed because there are no handlers.
System.out.println(page.evaluate("prompt('Enter string:')"));
```

This code above is equivalent to:

```java
Consumer<Dialog> handler = new Consumer<Dialog>() {
  @Override
  public void accept(Dialog dialog) {
    dialog.accept("foo");
    page.offDialog(this);
  }
};
page.onDialog(handler);

// prints 'foo'
System.out.println(page.evaluate("prompt('Enter string:')"));

// prints 'null' as the dialog will be auto-dismissed because there are no handlers.
System.out.println(page.evaluate("prompt('Enter string:')"));
```

**Usage**

```java
Page.onceDialog(handler);
```

**Arguments**
- `handler` Consumer<Dialog>
  
  Receives the Dialog object, it **must** either [Dialog.accept()](/api/class-dialog.mdx#dialog-accept) or [Dialog.dismiss()](/api/class-dialog.mdx#dialog-dismiss) the dialog - otherwise the page will [freeze](https://developer.mozilla.org/en-US/docs/Web/JavaScript/EventLoop#never_blocking) waiting for the dialog, and actions like click will never finish.

---

### opener {/* #page-opener */}



Returns the opener for popup pages and `null` for others. If the opener has been closed already the returns `null`.

**Usage**

```java
Page.opener();
```

**Returns**
- null | Page

---

### pageErrors {/* #page-page-errors */}



Returns up to (currently) 200 last page errors from this page. See [Page.onPageError(handler)](/api/class-page.mdx#page-event-page-error) for more details.

**Usage**

```java
Page.pageErrors();
```

**Returns**
- List<String>

---

### pause {/* #page-pause */}



Pauses script execution. Playwright will stop executing the script and wait for the user to either press the 'Resume' button in the page overlay or to call `playwright.resume()` in the DevTools console.

User can inspect selectors or perform manual steps while paused. Resume will continue running the original script from the place it was paused.

:::note

This method requires Playwright to be started in a headed mode, with a falsy [setHeadless](/api/class-browsertype.mdx#browser-type-launch-option-headless) option.
:::

**Usage**

```java
Page.pause();
```

**Returns**
- void

---

### pdf {/* #page-pdf */}



Returns the PDF buffer.

`page.pdf()` generates a pdf of the page with `print` css media. To generate a pdf with `screen` media, call [Page.emulateMedia()](/api/class-page.mdx#page-emulate-media) before calling `page.pdf()`:

:::note

By default, `page.pdf()` generates a pdf with modified colors for printing. Use the [`-webkit-print-color-adjust`](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-print-color-adjust) property to force rendering of exact colors.
:::

**Usage**

```java
// Generates a PDF with "screen" media type.
page.emulateMedia(new Page.EmulateMediaOptions().setMedia(Media.SCREEN));
page.pdf(new Page.PdfOptions().setPath(Paths.get("page.pdf")));
```

The [setWidth](/api/class-page.mdx#page-pdf-option-width), [setHeight](/api/class-page.mdx#page-pdf-option-height), and [setMargin](/api/class-page.mdx#page-pdf-option-margin) options accept values labeled with units. Unlabeled values are treated as pixels.

A few examples:
* `page.pdf({width: 100})` - prints with width set to 100 pixels
* `page.pdf({width: '100px'})` - prints with width set to 100 pixels
* `page.pdf({width: '10cm'})` - prints with width set to 10 centimeters.

All possible units are:
* `px` - pixel
* `in` - inch
* `cm` - centimeter
* `mm` - millimeter

The [setFormat](/api/class-page.mdx#page-pdf-option-format) options are:
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

[setHeaderTemplate](/api/class-page.mdx#page-pdf-option-header-template) and [setFooterTemplate](/api/class-page.mdx#page-pdf-option-footer-template) markup have the following limitations: > 1. Script tags inside templates are not evaluated. > 2. Page styles are not visible inside templates.
:::

**Arguments**
- `options` `Page.PdfOptions` *(optional)*
  - `setDisplayHeaderFooter` boolean *(optional)*
    
    Display header and footer. Defaults to `false`.
  - `setFooterTemplate` String *(optional)*
    
    HTML template for the print footer. Should use the same format as the [setHeaderTemplate](/api/class-page.mdx#page-pdf-option-header-template).
  - `setFormat` String *(optional)*
    
    Paper format. If set, takes priority over [setWidth](/api/class-page.mdx#page-pdf-option-width) or [setHeight](/api/class-page.mdx#page-pdf-option-height) options. Defaults to 'Letter'.
  - `setHeaderTemplate` String *(optional)*
    
    HTML template for the print header. Should be valid HTML markup with following classes used to inject printing values into them:
    * `'date'` formatted print date
    * `'title'` document title
    * `'url'` document location
    * `'pageNumber'` current page number
    * `'totalPages'` total pages in the document
  - `setHeight` String *(optional)*
    
    Paper height, accepts values labeled with units.
  - `setLandscape` boolean *(optional)*
    
    Paper orientation. Defaults to `false`.
  - `setMargin` Margin *(optional)*
    - `setTop` String *(optional)*
      
      Top margin, accepts values labeled with units. Defaults to `0`.
    - `setRight` String *(optional)*
      
      Right margin, accepts values labeled with units. Defaults to `0`.
    - `setBottom` String *(optional)*
      
      Bottom margin, accepts values labeled with units. Defaults to `0`.
    - `setLeft` String *(optional)*
      
      Left margin, accepts values labeled with units. Defaults to `0`.
    
    Paper margins, defaults to none.
  - `setOutline` boolean *(optional)* 
    
    Whether or not to embed the document outline into the PDF. Defaults to `false`.
  - `setPageRanges` String *(optional)*
    
    Paper ranges to print, e.g., '1-5, 8, 11-13'. Defaults to the empty string, which means print all pages.
  - `setPath` Path *(optional)*
    
    The file path to save the PDF to. If [setPath](/api/class-page.mdx#page-pdf-option-path) is a relative path, then it is resolved relative to the current working directory. If no path is provided, the PDF won't be saved to the disk.
  - `setPreferCSSPageSize` boolean *(optional)*
    
    Give any CSS `@page` size declared in the page priority over what is declared in [setWidth](/api/class-page.mdx#page-pdf-option-width) and [setHeight](/api/class-page.mdx#page-pdf-option-height) or [setFormat](/api/class-page.mdx#page-pdf-option-format) options. Defaults to `false`, which will scale the content to fit the paper size.
  - `setPrintBackground` boolean *(optional)*
    
    Print background graphics. Defaults to `false`.
  - `setScale` double *(optional)*
    
    Scale of the webpage rendering. Defaults to `1`. Scale amount must be between 0.1 and 2.
  - `setTagged` boolean *(optional)* 
    
    Whether or not to generate tagged (accessible) PDF. Defaults to `false`.
  - `setWidth` String *(optional)*
    
    Paper width, accepts values labeled with units.

**Returns**
- byte&#91;&#93;

---

### pickLocator {/* #page-pick-locator */}



Enters pick locator mode where hovering over page elements highlights them and shows the corresponding locator. Once the user clicks an element, the mode is deactivated and the Locator for the picked element is returned.

**Usage**

```java
Locator locator = page.pickLocator();
System.out.println(locator);
```

**Returns**
- Locator

---

### reload {/* #page-reload */}



This method reloads the current page, in the same way as if the user had triggered a browser refresh. Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect.

**Usage**

```java
Page.reload();
Page.reload(options);
```

**Arguments**
- `options` `Page.ReloadOptions` *(optional)*
  - `setTimeout` double *(optional)*
    
    Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [Page.setDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `setWaitUntil` `enum WaitUntilState { LOAD, DOMCONTENTLOADED, NETWORKIDLE, COMMIT }` *(optional)*
    
    When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
    * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- null | Response

---

### removeLocatorHandler {/* #page-remove-locator-handler */}



Removes all locator handlers added by [Page.addLocatorHandler()](/api/class-page.mdx#page-add-locator-handler) for a specific locator.

**Usage**

```java
Page.removeLocatorHandler(locator);
```

**Arguments**
- `locator` Locator
  
  Locator passed to [Page.addLocatorHandler()](/api/class-page.mdx#page-add-locator-handler).

**Returns**
- void

---

### requestGC {/* #page-request-gc */}



Request the page to perform garbage collection. Note that there is no guarantee that all unreachable objects will be collected.

This is useful to help detect memory leaks. For example, if your page has a large object `'suspect'` that might be leaked, you can check that it does not leak by using a [`WeakRef`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef).

```java
// 1. In your page, save a WeakRef for the "suspect".
page.evaluate("globalThis.suspectWeakRef = new WeakRef(suspect)");
// 2. Request garbage collection.
page.requestGC();
// 3. Check that weak ref does not deref to the original object.
assertTrue(page.evaluate("!globalThis.suspectWeakRef.deref()"));
```

**Usage**

```java
Page.requestGC();
```

**Returns**
- void

---

### requests {/* #page-requests */}



Returns up to (currently) 100 last network request from this page. See [Page.onRequest(handler)](/api/class-page.mdx#page-event-request) for more details.

Returned requests should be accessed immediately, otherwise they might be collected to prevent unbounded memory growth as new requests come in. Once collected, retrieving most information about the request is impossible.

Note that requests reported through the [Page.onRequest(handler)](/api/class-page.mdx#page-event-request) request are not collected, so there is a trade off between efficient memory usage with [Page.requests()](/api/class-page.mdx#page-requests) and the amount of available information reported through [Page.onRequest(handler)](/api/class-page.mdx#page-event-request).

**Usage**

```java
Page.requests();
```

**Returns**
- List<Request>

---

### route {/* #page-route */}



Routing provides the capability to modify network requests that are made by a page.

Once routing is enabled, every request matching the url pattern will stall unless it's continued, fulfilled or aborted.

:::note

The handler will only be called for the first url if the response is a redirect.
:::

:::note
[Page.route()](/api/class-page.mdx#page-route) will not intercept requests intercepted by Service Worker. See [this](https://github.com/microsoft/playwright/issues/1090) issue. We recommend disabling Service Workers when using request interception by setting [setServiceWorkers](/api/class-browser.mdx#browser-new-context-option-service-workers) to `'block'`.
:::

:::note
[Page.route()](/api/class-page.mdx#page-route) will not intercept the first request of a popup page. Use [BrowserContext.route()](/api/class-browsercontext.mdx#browser-context-route) instead.
:::

**Usage**

An example of a naive handler that aborts all image requests:

```java
Page page = browser.newPage();
page.route("**/*.{png,jpg,jpeg}", route -> route.abort());
page.navigate("https://example.com");
browser.close();
```

or the same snippet using a regex pattern instead:

```java
Page page = browser.newPage();
page.route(Pattern.compile("(\\.png$)|(\\.jpg$)"),route -> route.abort());
page.navigate("https://example.com");
browser.close();
```

It is possible to examine the request to decide the route action. For example, mocking all requests that contain some post data, and leaving all other requests as is:

```java
page.route("/api/**", route -> {
  if (route.request().postData().contains("my-string"))
    route.fulfill(new Route.FulfillOptions().setBody("mocked-data"));
  else
    route.resume();
});
```

If a request matches multiple registered routes, the most recently registered route takes precedence.

Page routes take precedence over browser context routes (set up with [BrowserContext.route()](/api/class-browsercontext.mdx#browser-context-route)) when request matches both handlers.

To remove a route with its handler you can use [Page.unroute()](/api/class-page.mdx#page-unroute).

:::note

Enabling routing disables http cache.
:::

**Arguments**
- `url` String | Pattern | Predicate<String>
  
  A glob pattern, regex pattern, or predicate that receives a URL to match during routing. If [setBaseURL](/api/class-browser.mdx#browser-new-context-option-base-url) is set in the context options and the provided URL is a string that does not start with `*`, it is resolved using the [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor.
- `handler` Consumer<Route>
  
  handler function to route the request.
- `options` `Page.RouteOptions` *(optional)*
  - `setTimes` int *(optional)* 
    
    How often a route should be used. By default it will be used every time.

**Returns**
- Disposable

---

### routeFromHAR {/* #page-route-from-har */}



If specified the network requests that are made in the page will be served from the HAR file. Read more about [Replaying from HAR](../mock.mdx#replaying-from-har).

Playwright will not serve requests intercepted by Service Worker from the HAR file. See [this](https://github.com/microsoft/playwright/issues/1090) issue. We recommend disabling Service Workers when using request interception by setting [setServiceWorkers](/api/class-browser.mdx#browser-new-context-option-service-workers) to `'block'`.

**Usage**

```java
Page.routeFromHAR(har);
Page.routeFromHAR(har, options);
```

**Arguments**
- `har` Path
  
  Path to a [HAR](http://www.softwareishard.com/blog/har-12-spec) file with prerecorded network data. If `path` is a relative path, then it is resolved relative to the current working directory.
- `options` `Page.RouteFromHAROptions` *(optional)*
  - `setNotFound` `enum HarNotFound { ABORT, FALLBACK }` *(optional)*
    * If set to 'abort' any request not found in the HAR file will be aborted.
    * If set to 'fallback' missing requests will be sent to the network.
    
    Defaults to abort.
  - `setUpdate` boolean *(optional)*
    
    If specified, updates the given HAR with the actual network information instead of serving from file. The file is written to disk when [BrowserContext.close()](/api/class-browsercontext.mdx#browser-context-close) is called.
  - `setUpdateContent` `enum RouteFromHarUpdateContentPolicy { EMBED, ATTACH }` *(optional)* 
    
    Optional setting to control resource content management. If `attach` is specified, resources are persisted as separate files or entries in the ZIP archive. If `embed` is specified, content is stored inline the HAR file.
  - `setUpdateMode` `enum HarMode { FULL, MINIMAL }` *(optional)* 
    
    When set to `minimal`, only record information necessary for routing from HAR. This omits sizes, timing, page, cookies, security and other types of HAR information that are not used when replaying from HAR. Defaults to `minimal`.
  - `setUrl` String | Pattern *(optional)*
    
    A glob pattern, regular expression or predicate to match the request URL. Only requests with URL matching the pattern will be served from the HAR file. If not specified, all requests are served from the HAR file.

**Returns**
- void

---

### routeWebSocket {/* #page-route-web-socket */}



This method allows to modify websocket connections that are made by the page.

Note that only `WebSocket`s created after this method was called will be routed. It is recommended to call this method before navigating the page.

**Usage**

Below is an example of a simple mock that responds to a single message. See WebSocketRoute for more details and examples.

```java
page.routeWebSocket("/ws", ws -> {
  ws.onMessage(frame -> {
    if ("request".equals(frame.text()))
      ws.send("response");
  });
});
```

**Arguments**
- `url` String | Pattern | Predicate<String>
  
  Only WebSockets with the url matching this pattern will be routed. A string pattern can be relative to the [setBaseURL](/api/class-browser.mdx#browser-new-context-option-base-url) context option.
- `handler` Consumer<WebSocketRoute>
  
  Handler function to route the WebSocket.

**Returns**
- void

---

### screenshot {/* #page-screenshot */}



Returns the buffer with the captured screenshot.

**Usage**

```java
Page.screenshot();
Page.screenshot(options);
```

**Arguments**
- `options` `Page.ScreenshotOptions` *(optional)*
  - `setAnimations` `enum ScreenshotAnimations { DISABLED, ALLOW }` *(optional)*
    
    When set to `"disabled"`, stops CSS animations, CSS transitions and Web Animations. Animations get different treatment depending on their duration:
    * finite animations are fast-forwarded to completion, so they'll fire `transitionend` event.
    * infinite animations are canceled to initial state, and then played over after the screenshot.
    
    Defaults to `"allow"` that leaves animations untouched.
  - `setCaret` `enum ScreenshotCaret { HIDE, INITIAL }` *(optional)*
    
    When set to `"hide"`, screenshot will hide text caret. When set to `"initial"`, text caret behavior will not be changed.  Defaults to `"hide"`.
  - `setClip` Clip *(optional)*
    - `setX` double
      
      x-coordinate of top-left corner of clip area
    - `setY` double
      
      y-coordinate of top-left corner of clip area
    - `setWidth` double
      
      width of clipping area
    - `setHeight` double
      
      height of clipping area
    
    An object which specifies clipping of the resulting image.
  - `setFullPage` boolean *(optional)*
    
    When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Defaults to `false`.
  - `setMask` List<Locator> *(optional)*
    
    Specify locators that should be masked when the screenshot is taken. Masked elements will be overlaid with a pink box `#FF00FF` (customized by [setMaskColor](/api/class-page.mdx#page-screenshot-option-mask-color)) that completely covers its bounding box. The mask is also applied to invisible elements, see [Matching only visible elements](../locators.mdx#matching-only-visible-elements) to disable that.
  - `setMaskColor` String *(optional)* 
    
    Specify the color of the overlay box for masked elements, in [CSS color format](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value). Default color is pink `#FF00FF`.
  - `setOmitBackground` boolean *(optional)*
    
    Hides default white background and allows capturing screenshots with transparency. Not applicable to `jpeg` images. Defaults to `false`.
  - `setPath` Path *(optional)*
    
    The file path to save the image to. The screenshot type will be inferred from file extension. If [setPath](/api/class-page.mdx#page-screenshot-option-path) is a relative path, then it is resolved relative to the current working directory. If no path is provided, the image won't be saved to the disk.
  - `setQuality` int *(optional)*
    
    The quality of the image, between 0-100. Not applicable to `png` images. For `jpeg` the default is `80`. For `webp`, a quality of `100` (the default) produces a lossless image, while lower values use lossy compression.
  - `setScale` `enum ScreenshotScale { CSS, DEVICE }` *(optional)*
    
    When set to `"css"`, screenshot will have a single pixel per each css pixel on the page. For high-dpi devices, this will keep screenshots small. Using `"device"` option will produce a single pixel per each device pixel, so screenshots of high-dpi devices will be twice as large or even larger.
    
    Defaults to `"device"`.
  - `setStyle` String *(optional)* 
    
    Text of the stylesheet to apply while making the screenshot. This is where you can hide dynamic elements, make elements invisible or change their properties to help you creating repeatable screenshots. This stylesheet pierces the Shadow DOM and applies to the inner frames.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `setType` `enum ScreenshotType { PNG, JPEG, WEBP }` *(optional)*
    
    Specify screenshot type, defaults to `png`.

**Returns**
- byte&#91;&#93;

---

### setContent {/* #page-set-content */}



This method internally calls [document.write()](https://developer.mozilla.org/en-US/docs/Web/API/Document/write), inheriting all its specific characteristics and behaviors.

**Usage**

```java
Page.setContent(html);
Page.setContent(html, options);
```

**Arguments**
- `html` String
  
  HTML markup to assign to the page.
- `options` `Page.SetContentOptions` *(optional)*
  - `setTimeout` double *(optional)*
    
    Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [Page.setDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `setWaitUntil` `enum WaitUntilState { LOAD, DOMCONTENTLOADED, NETWORKIDLE, COMMIT }` *(optional)*
    
    When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
    * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- void

---

### setDefaultNavigationTimeout {/* #page-set-default-navigation-timeout */}



This setting will change the default maximum navigation time for the following methods and related shortcuts:
* [Page.goBack()](/api/class-page.mdx#page-go-back)
* [Page.goForward()](/api/class-page.mdx#page-go-forward)
* [Page.navigate()](/api/class-page.mdx#page-goto)
* [Page.reload()](/api/class-page.mdx#page-reload)
* [Page.setContent()](/api/class-page.mdx#page-set-content)
* [Page.waitForNavigation()](/api/class-page.mdx#page-wait-for-navigation)
* [Page.waitForURL()](/api/class-page.mdx#page-wait-for-url)

:::note

[Page.setDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) takes priority over [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout), [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) and [BrowserContext.setDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout).
:::

**Usage**

```java
Page.setDefaultNavigationTimeout(timeout);
```

**Arguments**
- `timeout` double
  
  Maximum navigation time in milliseconds

---

### setDefaultTimeout {/* #page-set-default-timeout */}



This setting will change the default maximum time for all the methods accepting [timeout](/api/class-page.mdx#page-set-default-timeout-option-timeout) option.

:::note

[Page.setDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) takes priority over [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout).
:::

**Usage**

```java
Page.setDefaultTimeout(timeout);
```

**Arguments**
- `timeout` double
  
  Maximum time in milliseconds. Pass `0` to disable timeout.

---

### setExtraHTTPHeaders {/* #page-set-extra-http-headers */}



The extra HTTP headers will be sent with every request the page initiates.

:::note

[Page.setExtraHTTPHeaders()](/api/class-page.mdx#page-set-extra-http-headers) does not guarantee the order of headers in the outgoing requests.
:::

**Usage**

```java
Page.setExtraHTTPHeaders(headers);
```

**Arguments**
- `headers` Map<String, String>
  
  An object containing additional HTTP headers to be sent with every request. All header values must be strings.

**Returns**
- void

---

### setViewportSize {/* #page-set-viewport-size */}



In the case of multiple pages in a single browser, each page can have its own viewport size. However, [Browser.newContext()](/api/class-browser.mdx#browser-new-context) allows to set viewport size (and more) for all pages in the context at once.

[Page.setViewportSize()](/api/class-page.mdx#page-set-viewport-size) will resize the page. A lot of websites don't expect phones to change size, so you should set the viewport size before navigating to the page. [Page.setViewportSize()](/api/class-page.mdx#page-set-viewport-size) will also reset `screen` size, use [Browser.newContext()](/api/class-browser.mdx#browser-new-context) with `screen` and `viewport` parameters if you need better control of these properties.

**Usage**

```java
Page page = browser.newPage();
page.setViewportSize(640, 480);
page.navigate("https://example.com");
```

**Arguments**
- `width` int 
  
  Page width in pixels.
- `height` int 
  
  Page height in pixels.

**Returns**
- void

---

### title {/* #page-title */}



Returns the page's title.

**Usage**

```java
Page.title();
```

**Returns**
- String

---

### unroute {/* #page-unroute */}



Removes a route created with [Page.route()](/api/class-page.mdx#page-route). When [handler](/api/class-page.mdx#page-unroute-option-handler) is not specified, removes all routes for the [url](/api/class-page.mdx#page-unroute-option-url).

**Usage**

```java
Page.unroute(url);
Page.unroute(url, handler);
```

**Arguments**
- `url` String | Pattern | Predicate<String>
  
  A glob pattern, regex pattern, or predicate receiving URL to match while routing.
- `handler` Consumer<Route> *(optional)*
  
  Optional handler function to route the request.

**Returns**
- void

---

### unrouteAll {/* #page-unroute-all */}



Removes all routes created with [Page.route()](/api/class-page.mdx#page-route) and [Page.routeFromHAR()](/api/class-page.mdx#page-route-from-har).

**Usage**

```java
Page.unrouteAll();
```

**Returns**
- void

---

### url {/* #page-url */}



**Usage**

```java
Page.url();
```

**Returns**
- String

---

### video {/* #page-video */}



Video object associated with this page. Can be used to access the video file when using the `recordVideo` context option.

**Usage**

```java
Page.video();
```

**Returns**
- null | Video

---

### viewportSize {/* #page-viewport-size */}



**Usage**

```java
Page.viewportSize();
```

**Returns**
- null | ViewportSize
  - `width` int
    
    page width in pixels.
  - `height` int
    
    page height in pixels.

---

### waitForClose {/* #page-wait-for-close */}



Performs action and waits for the Page to close.

**Usage**

```java
Page.waitForClose(callback);
Page.waitForClose(callback, options);
```

**Arguments**
- `options` `Page.WaitForCloseOptions` *(optional)*
  - `setTimeout` double *(optional)* 
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).
- `callback` Runnable 
  
  Callback that performs the action triggering the event.

**Returns**
- Page

---

### waitForCondition {/* #page-wait-for-condition */}



The method will block until the condition returns true. All Playwright events will be dispatched while the method is waiting for the condition.

**Usage**

Use the method to wait for a condition that depends on page events:

```java
List<String> messages = new ArrayList<>();
page.onConsoleMessage(m -> messages.add(m.text()));
page.getByText("Submit button").click();
page.waitForCondition(() -> messages.size() > 3);
```

**Arguments**
- `condition` BooleanSupplier
  
  Condition to wait for.
- `options` `Page.WaitForConditionOptions` *(optional)*
  - `setTimeout` double *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- void

---

### waitForConsoleMessage {/* #page-wait-for-console-message */}



Performs action and waits for a ConsoleMessage to be logged by in the page. If predicate is provided, it passes ConsoleMessage value into the `predicate` function and waits for `predicate(message)` to return a truthy value. Will throw an error if the page is closed before the [Page.onConsoleMessage(handler)](/api/class-page.mdx#page-event-console) event is fired.

**Usage**

```java
Page.waitForConsoleMessage(callback);
Page.waitForConsoleMessage(callback, options);
```

**Arguments**
- `options` `Page.WaitForConsoleMessageOptions` *(optional)*
  - `setPredicate` Predicate<ConsoleMessage> *(optional)*
    
    Receives the ConsoleMessage object and resolves to truthy value when the waiting should resolve.
  - `setTimeout` double *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).
- `callback` Runnable
  
  Callback that performs the action triggering the event.

**Returns**
- ConsoleMessage

---

### waitForDownload {/* #page-wait-for-download */}



Performs action and waits for a new Download. If predicate is provided, it passes Download value into the `predicate` function and waits for `predicate(download)` to return a truthy value. Will throw an error if the page is closed before the download event is fired.

**Usage**

```java
Page.waitForDownload(callback);
Page.waitForDownload(callback, options);
```

**Arguments**
- `options` `Page.WaitForDownloadOptions` *(optional)*
  - `setPredicate` Predicate<Download> *(optional)*
    
    Receives the Download object and resolves to truthy value when the waiting should resolve.
  - `setTimeout` double *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).
- `callback` Runnable
  
  Callback that performs the action triggering the event.

**Returns**
- Download

---

### waitForFileChooser {/* #page-wait-for-file-chooser */}



Performs action and waits for a new FileChooser to be created. If predicate is provided, it passes FileChooser value into the `predicate` function and waits for `predicate(fileChooser)` to return a truthy value. Will throw an error if the page is closed before the file chooser is opened.

**Usage**

```java
Page.waitForFileChooser(callback);
Page.waitForFileChooser(callback, options);
```

**Arguments**
- `options` `Page.WaitForFileChooserOptions` *(optional)*
  - `setPredicate` Predicate<FileChooser> *(optional)*
    
    Receives the FileChooser object and resolves to truthy value when the waiting should resolve.
  - `setTimeout` double *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).
- `callback` Runnable
  
  Callback that performs the action triggering the event.

**Returns**
- FileChooser

---

### waitForFunction {/* #page-wait-for-function */}



Returns when the [expression](/api/class-page.mdx#page-wait-for-function-option-expression) returns a truthy value. It resolves to a JSHandle of the truthy value.

**Usage**

The [Page.waitForFunction()](/api/class-page.mdx#page-wait-for-function) can be used to observe viewport size change:

```java
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType webkit = playwright.webkit();
      Browser browser = webkit.launch();
      Page page = browser.newPage();
      page.setViewportSize(50,  50);
      page.waitForFunction("() => window.innerWidth < 100");
      browser.close();
    }
  }
}
```

To pass an argument to the predicate of [Page.waitForFunction()](/api/class-page.mdx#page-wait-for-function) function:

```java
String selector = ".foo";
page.waitForFunction("selector => !!document.querySelector(selector)", selector);
```

**Arguments**
- `expression` String
  
  JavaScript expression to be evaluated in the browser context. If the expression evaluates to a function, the function is automatically invoked.
- `arg` EvaluationArgument *(optional)*
  
  Optional argument to pass to [expression](/api/class-page.mdx#page-wait-for-function-option-expression).
- `options` `Page.WaitForFunctionOptions` *(optional)*
  - `setPollingInterval` double *(optional)*
    
    If specified, then it is treated as an interval in milliseconds at which the function would be executed. By default if the option is not specified [expression](/api/class-page.mdx#page-wait-for-function-option-expression) is executed in `requestAnimationFrame` callback.
  - `setTimeout` double *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- JSHandle

---

### waitForLoadState {/* #page-wait-for-load-state */}



Returns when the required load state has been reached.

This resolves when the page reaches a required load state, `load` by default. The navigation must have been committed when this method is called. If current document has already reached the required state, resolves immediately.

:::note

Most of the time, this method is not needed because Playwright [auto-waits before every action](../actionability.mdx).
:::

**Usage**

```java
page.getByRole(AriaRole.BUTTON).click(); // Click triggers navigation.
page.waitForLoadState(); // The promise resolves after "load" event.
```

```java
Page popup = page.waitForPopup(() -> {
  page.getByRole(AriaRole.BUTTON).click(); // Click triggers a popup.
});
// Wait for the "DOMContentLoaded" event
popup.waitForLoadState(LoadState.DOMCONTENTLOADED);
System.out.println(popup.title()); // Popup is ready to use.
```

**Arguments**
- `state` `enum LoadState { LOAD, DOMCONTENTLOADED, NETWORKIDLE }` *(optional)*
  
  Optional load state to wait for, defaults to `load`. If the state has been already reached while loading current document, the method resolves immediately. Can be one of:
  * `'load'` - wait for the `load` event to be fired.
  * `'domcontentloaded'` - wait for the `DOMContentLoaded` event to be fired.
  * `'networkidle'` - **DISCOURAGED** wait until there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
- `options` `Page.WaitForLoadStateOptions` *(optional)*
  - `setTimeout` double *(optional)*
    
    Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [Page.setDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- void

---

### waitForPopup {/* #page-wait-for-popup */}



Performs action and waits for a popup Page. If predicate is provided, it passes Popup value into the `predicate` function and waits for `predicate(page)` to return a truthy value. Will throw an error if the page is closed before the popup event is fired.

**Usage**

```java
Page.waitForPopup(callback);
Page.waitForPopup(callback, options);
```

**Arguments**
- `options` `Page.WaitForPopupOptions` *(optional)*
  - `setPredicate` Predicate<Page> *(optional)*
    
    Receives the Page object and resolves to truthy value when the waiting should resolve.
  - `setTimeout` double *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).
- `callback` Runnable
  
  Callback that performs the action triggering the event.

**Returns**
- Page

---

### waitForRequest {/* #page-wait-for-request */}



Waits for the matching request and returns it. See [waiting for event](../events.mdx#waiting-for-event) for more details about events.

**Usage**

```java
// Waits for the next request with the specified url
Request request = page.waitForRequest("https://example.com/resource", () -> {
  // Triggers the request
  page.getByText("trigger request").click();
});

// Waits for the next request matching some conditions
Request request = page.waitForRequest(request -> "https://example.com".equals(request.url()) && "GET".equals(request.method()), () -> {
  // Triggers the request
  page.getByText("trigger request").click();
});
```

**Arguments**
- `urlOrPredicate` String | Pattern | Predicate<Request>
  
  Request URL string, regex or predicate receiving Request object. When a [setBaseURL](/api/class-browser.mdx#browser-new-context-option-base-url) via the context options was provided and the passed URL is a path, it gets merged via the [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor.
- `options` `Page.WaitForRequestOptions` *(optional)*
  - `setTimeout` double *(optional)*
    
    Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be changed by using the [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) method.
- `callback` Runnable 
  
  Callback that performs the action triggering the event.

**Returns**
- Request

---

### waitForRequestFinished {/* #page-wait-for-request-finished */}



Performs action and waits for a Request to finish loading. If predicate is provided, it passes Request value into the `predicate` function and waits for `predicate(request)` to return a truthy value. Will throw an error if the page is closed before the [Page.onRequestFinished(handler)](/api/class-page.mdx#page-event-request-finished) event is fired.

**Usage**

```java
Page.waitForRequestFinished(callback);
Page.waitForRequestFinished(callback, options);
```

**Arguments**
- `options` `Page.WaitForRequestFinishedOptions` *(optional)*
  - `setPredicate` Predicate<Request> *(optional)*
    
    Receives the Request object and resolves to truthy value when the waiting should resolve.
  - `setTimeout` double *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).
- `callback` Runnable
  
  Callback that performs the action triggering the event.

**Returns**
- Request

---

### waitForResponse {/* #page-wait-for-response */}



Returns the matched response. See [waiting for event](../events.mdx#waiting-for-event) for more details about events.

**Usage**

```java
// Waits for the next response with the specified url
Response response = page.waitForResponse("https://example.com/resource", () -> {
  // Triggers the response
  page.getByText("trigger response").click();
});

// Waits for the next response matching some conditions
Response response = page.waitForResponse(response -> "https://example.com".equals(response.url()) && response.status() == 200 && "GET".equals(response.request().method()), () -> {
  // Triggers the response
  page.getByText("trigger response").click();
});
```

**Arguments**
- `urlOrPredicate` String | Pattern | Predicate<Response>
  
  Request URL string, regex or predicate receiving Response object. When a [setBaseURL](/api/class-browser.mdx#browser-new-context-option-base-url) via the context options was provided and the passed URL is a path, it gets merged via the [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor.
- `options` `Page.WaitForResponseOptions` *(optional)*
  - `setTimeout` double *(optional)*
    
    Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
- `callback` Runnable 
  
  Callback that performs the action triggering the event.

**Returns**
- Response

---

### waitForURL {/* #page-wait-for-url */}



Waits for the main frame to navigate to the given URL.

**Usage**

```java
page.click("a.delayed-navigation"); // Clicking the link will indirectly cause a navigation
page.waitForURL("**/target.html");
```

**Arguments**
- `url` String | Pattern | Predicate<String>
  
  A glob pattern, regex pattern, or predicate receiving URL to match while waiting for the navigation. Note that if the parameter is a string without wildcard characters, the method will wait for navigation to URL that is exactly equal to the string.
- `options` `Page.WaitForURLOptions` *(optional)*
  - `setTimeout` double *(optional)*
    
    Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [Page.setDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `setWaitUntil` `enum WaitUntilState { LOAD, DOMCONTENTLOADED, NETWORKIDLE, COMMIT }` *(optional)*
    
    When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
    * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- void

---

### waitForWebSocket {/* #page-wait-for-web-socket */}



Performs action and waits for a new WebSocket. If predicate is provided, it passes WebSocket value into the `predicate` function and waits for `predicate(webSocket)` to return a truthy value. Will throw an error if the page is closed before the WebSocket event is fired.

**Usage**

```java
Page.waitForWebSocket(callback);
Page.waitForWebSocket(callback, options);
```

**Arguments**
- `options` `Page.WaitForWebSocketOptions` *(optional)*
  - `setPredicate` Predicate<WebSocket> *(optional)*
    
    Receives the WebSocket object and resolves to truthy value when the waiting should resolve.
  - `setTimeout` double *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).
- `callback` Runnable
  
  Callback that performs the action triggering the event.

**Returns**
- WebSocket

---

### waitForWorker {/* #page-wait-for-worker */}



Performs action and waits for a new Worker. If predicate is provided, it passes Worker value into the `predicate` function and waits for `predicate(worker)` to return a truthy value. Will throw an error if the page is closed before the worker event is fired.

**Usage**

```java
Page.waitForWorker(callback);
Page.waitForWorker(callback, options);
```

**Arguments**
- `options` `Page.WaitForWorkerOptions` *(optional)*
  - `setPredicate` Predicate<Worker> *(optional)*
    
    Receives the Worker object and resolves to truthy value when the waiting should resolve.
  - `setTimeout` double *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).
- `callback` Runnable
  
  Callback that performs the action triggering the event.

**Returns**
- Worker

---

### workers {/* #page-workers */}



This method returns all of the dedicated [WebWorkers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) associated with the page.

:::note

This does not contain ServiceWorkers
:::

**Usage**

```java
Page.workers();
```

**Returns**
- List<Worker>

---

## Properties

### clock() {/* #page-clock */}



Playwright has ability to mock clock and passage of time.

**Usage**

```java
Page.clock()
```

**Returns**
- Clock

---

### keyboard() {/* #page-keyboard */}



**Usage**

```java
Page.keyboard()
```

**Returns**
- Keyboard

---

### localStorage() {/* #page-local-storage */}



Provides access to the page's `localStorage` for the current origin. See WebStorage.

**Usage**

```java
Page.localStorage()
```

**Returns**
- WebStorage

---

### mouse() {/* #page-mouse */}



**Usage**

```java
Page.mouse()
```

**Returns**
- Mouse

---

### request() {/* #page-request */}



API testing helper associated with this page. This method returns the same instance as [BrowserContext.request()](/api/class-browsercontext.mdx#browser-context-request) on the page's context. See [BrowserContext.request()](/api/class-browsercontext.mdx#browser-context-request) for more details.

**Usage**

```java
Page.request()
```

**Returns**
- APIRequestContext

---

### screencast() {/* #page-screencast */}



Screencast object associated with this page.

**Usage**

**Returns**
- Screencast

---

### sessionStorage() {/* #page-session-storage */}



Provides access to the page's `sessionStorage` for the current origin. See WebStorage.

**Usage**

```java
Page.sessionStorage()
```

**Returns**
- WebStorage

---

### touchscreen() {/* #page-touchscreen */}



**Usage**

```java
Page.touchscreen()
```

**Returns**
- Touchscreen

---

## Events

### onClose(handler) {/* #page-event-close */}



Emitted when the page closes.

**Usage**

```java
Page.onClose(handler)
```

**Event data**
- Page

---

### onConsoleMessage(handler) {/* #page-event-console */}



Emitted when JavaScript within the page calls one of console API methods, e.g. `console.log` or `console.dir`.

The arguments passed into `console.log` are available on the ConsoleMessage event handler argument.

**Usage**

```java
page.onConsoleMessage(msg -> {
  for (int i = 0; i < msg.args().size(); ++i)
    System.out.println(i + ": " + msg.args().get(i).jsonValue());
});
page.evaluate("() => console.log('hello', 5, { foo: 'bar' })");
```

**Event data**
- ConsoleMessage

---

### onCrash(handler) {/* #page-event-crash */}



Emitted when the page crashes. Browser pages might crash if they try to allocate too much memory. When the page crashes, ongoing and subsequent operations will throw.

The most common way to deal with crashes is to catch an exception:

```java
try {
  // Crash might happen during a click.
  page.click("button");
  // Or while waiting for an event.
  page.waitForPopup(() -> {});
} catch (PlaywrightException e) {
  // When the page crashes, exception message contains "crash".
}
```

**Usage**

```java
Page.onCrash(handler)
```

**Event data**
- Page

---

### onDialog(handler) {/* #page-event-dialog */}



Emitted when a JavaScript dialog appears, such as `alert`, `prompt`, `confirm` or `beforeunload`. Listener **must** either [Dialog.accept()](/api/class-dialog.mdx#dialog-accept) or [Dialog.dismiss()](/api/class-dialog.mdx#dialog-dismiss) the dialog - otherwise the page will [freeze](https://developer.mozilla.org/en-US/docs/Web/JavaScript/EventLoop#never_blocking) waiting for the dialog, and actions like click will never finish.

**Usage**

```java
page.onDialog(dialog -> {
  dialog.accept();
});
```

:::note
When no [Page.onDialog(handler)](/api/class-page.mdx#page-event-dialog) or [BrowserContext.onDialog(handler)](/api/class-browsercontext.mdx#browser-context-event-dialog) listeners are present, all dialogs are automatically dismissed.
:::

**Event data**
- Dialog

---

### onDOMContentLoaded(handler) {/* #page-event-dom-content-loaded */}



Emitted when the JavaScript [`DOMContentLoaded`](https://developer.mozilla.org/en-US/docs/Web/Events/DOMContentLoaded) event is dispatched.

**Usage**

```java
Page.onDOMContentLoaded(handler)
```

**Event data**
- Page

---

### onDownload(handler) {/* #page-event-download */}



Emitted when attachment download started. User can access basic file operations on downloaded content via the passed Download instance.

**Usage**

```java
Page.onDownload(handler)
```

**Event data**
- Download

---

### onFileChooser(handler) {/* #page-event-file-chooser */}



Emitted when a file chooser is supposed to appear, such as after clicking the  `<input type=file>`. Playwright can respond to it via setting the input files using [FileChooser.setFiles()](/api/class-filechooser.mdx#file-chooser-set-files) that can be uploaded after that.

```java
page.onFileChooser(fileChooser -> {
  fileChooser.setFiles(Paths.get("/tmp/myfile.pdf"));
});
```

**Usage**

```java
Page.onFileChooser(handler)
```

**Event data**
- FileChooser

---

### onFrameAttached(handler) {/* #page-event-frame-attached */}



Emitted when a frame is attached.

**Usage**

```java
Page.onFrameAttached(handler)
```

**Event data**
- Frame

---

### onFrameDetached(handler) {/* #page-event-frame-detached */}



Emitted when a frame is detached.

**Usage**

```java
Page.onFrameDetached(handler)
```

**Event data**
- Frame

---

### onFrameNavigated(handler) {/* #page-event-frame-navigated */}



Emitted when a frame is navigated to a new url.

**Usage**

```java
Page.onFrameNavigated(handler)
```

**Event data**
- Frame

---

### onLoad(handler) {/* #page-event-load */}



Emitted when the JavaScript [`load`](https://developer.mozilla.org/en-US/docs/Web/Events/load) event is dispatched.

**Usage**

```java
Page.onLoad(handler)
```

**Event data**
- Page

---

### onPageError(handler) {/* #page-event-page-error */}



Emitted when an uncaught exception happens within the page.

```java
// Log all uncaught errors to the terminal
page.onPageError(exception -> {
  System.out.println("Uncaught exception: " + exception);
});

// Navigate to a page with an exception.
page.navigate("data:text/html,<script>throw new Error('Test')</script>");
```

**Usage**

```java
Page.onPageError(handler)
```

**Event data**
- String

---

### onPopup(handler) {/* #page-event-popup */}



Emitted when the page opens a new tab or window. This event is emitted in addition to the [BrowserContext.onPage(handler)](/api/class-browsercontext.mdx#browser-context-event-page), but only for popups relevant to this page.

The earliest moment that page is available is when it has navigated to the initial url. For example, when opening a popup with `window.open('http://example.com')`, this event will fire when the network request to "http://example.com" is done and its response has started loading in the popup. If you would like to route/listen to this network request, use [BrowserContext.route()](/api/class-browsercontext.mdx#browser-context-route) and [BrowserContext.onRequest(handler)](/api/class-browsercontext.mdx#browser-context-event-request) respectively instead of similar methods on the Page.

```java
Page popup = page.waitForPopup(() -> {
  page.getByText("open the popup").click();
});
System.out.println(popup.evaluate("location.href"));
```

:::note
Use [Page.waitForLoadState()](/api/class-page.mdx#page-wait-for-load-state) to wait until the page gets to a particular state (you should not need it in most cases).
:::

**Usage**

```java
Page.onPopup(handler)
```

**Event data**
- Page

---

### onRequest(handler) {/* #page-event-request */}



Emitted when a page issues a request. The request object is read-only. In order to intercept and mutate requests, see [Page.route()](/api/class-page.mdx#page-route) or [BrowserContext.route()](/api/class-browsercontext.mdx#browser-context-route).

**Usage**

```java
Page.onRequest(handler)
```

**Event data**
- Request

---

### onRequestFailed(handler) {/* #page-event-request-failed */}



Emitted when a request fails, for example by timing out.

```java
page.onRequestFailed(request -> {
  System.out.println(request.url() + " " + request.failure());
});
```

:::note
HTTP Error responses, such as 404 or 503, are still successful responses from HTTP standpoint, so request will complete with [Page.onRequestFinished(handler)](/api/class-page.mdx#page-event-request-finished) event and not with [Page.onRequestFailed(handler)](/api/class-page.mdx#page-event-request-failed). A request will only be considered failed when the client cannot get an HTTP response from the server, e.g. due to network error net::ERR_FAILED.
:::

**Usage**

```java
Page.onRequestFailed(handler)
```

**Event data**
- Request

---

### onRequestFinished(handler) {/* #page-event-request-finished */}



Emitted when a request finishes successfully after downloading the response body. For a successful response, the sequence of events is `request`, `response` and `requestfinished`.

**Usage**

```java
Page.onRequestFinished(handler)
```

**Event data**
- Request

---

### onResponse(handler) {/* #page-event-response */}



Emitted when response status and headers are received for a request. For a successful response, the sequence of events is `request`, `response` and `requestfinished`.

**Usage**

```java
Page.onResponse(handler)
```

**Event data**
- Response

---

### onWebSocket(handler) {/* #page-event-web-socket */}



Emitted when WebSocket request is sent.

**Usage**

```java
Page.onWebSocket(handler)
```

**Event data**
- WebSocket

---

### onWorker(handler) {/* #page-event-worker */}



Emitted when a dedicated [WebWorker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) is spawned by the page.

**Usage**

```java
Page.onWorker(handler)
```

**Event data**
- Worker

---

## Deprecated

### check {/* #page-check */}



:::warningDiscouraged

Use locator-based [Locator.check()](/api/class-locator.mdx#locator-check) instead. Read more about [locators](../locators.mdx).

:::


This method checks an element matching [selector](/api/class-page.mdx#page-check-option-selector) by performing the following steps:
1. Find an element matching [selector](/api/class-page.mdx#page-check-option-selector). If there is none, wait until a matching element is attached to the DOM.
1. Ensure that matched element is a checkbox or a radio input. If not, this method throws. If the element is already checked, this method returns immediately.
1. Wait for [actionability](../actionability.mdx) checks on the matched element, unless [setForce](/api/class-page.mdx#page-check-option-force) option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [Page.mouse()](/api/class-page.mdx#page-mouse) to click in the center of the element.
1. Ensure that the element is now checked. If not, this method throws.

When all steps combined have not finished during the specified [setTimeout](/api/class-page.mdx#page-check-option-timeout), this method throws a TimeoutError. Passing zero timeout disables this.

**Usage**

```java
Page.check(selector);
Page.check(selector, options);
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `Page.CheckOptions` *(optional)*
  - `setForce` boolean *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `setNoWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `setPosition` Position *(optional)* 
    - `setX` double
      
      
    - `setY` double
      
      
    A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
  - `setScroll` `enum ScrollMode { AUTO, NONE }` *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `setTrial` boolean *(optional)* 
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it.

**Returns**
- void

---

### click {/* #page-click */}



:::warningDiscouraged

Use locator-based [Locator.click()](/api/class-locator.mdx#locator-click) instead. Read more about [locators](../locators.mdx).

:::


This method clicks an element matching [selector](/api/class-page.mdx#page-click-option-selector) by performing the following steps:
1. Find an element matching [selector](/api/class-page.mdx#page-click-option-selector). If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](../actionability.mdx) checks on the matched element, unless [setForce](/api/class-page.mdx#page-click-option-force) option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [Page.mouse()](/api/class-page.mdx#page-mouse) to click in the center of the element, or the specified [setPosition](/api/class-page.mdx#page-click-option-position).
1. Wait for initiated navigations to either succeed or fail, unless [setNoWaitAfter](/api/class-page.mdx#page-click-option-no-wait-after) option is set.

When all steps combined have not finished during the specified [setTimeout](/api/class-page.mdx#page-click-option-timeout), this method throws a TimeoutError. Passing zero timeout disables this.

**Usage**

```java
Page.click(selector);
Page.click(selector, options);
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `Page.ClickOptions` *(optional)*
  - `setButton` `enum MouseButton { LEFT, RIGHT, MIDDLE }` *(optional)*
    
    Defaults to `left`.
  - `setClickCount` int *(optional)*
    
    defaults to 1. See UIEvent.detail.
  - `setDelay` double *(optional)*
    
    Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `setForce` boolean *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `setModifiers` List<`enum KeyboardModifier { ALT, CONTROL, CONTROLORMETA, META, SHIFT }`> *(optional)*
    
    Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used. "ControlOrMeta" resolves to "Control" on Windows and Linux and to "Meta" on macOS.
  - `setNoWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option will default to `true` in the future.
    :::
    
    
    Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `setPosition` Position *(optional)*
    - `setX` double
      
      
    - `setY` double
      
      
    A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
  - `setScroll` `enum ScrollMode { AUTO, NONE }` *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `setTrial` boolean *(optional)* 
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it. Note that keyboard `modifiers` will be pressed regardless of `trial` to allow testing elements which are only visible when those keys are pressed.

**Returns**
- void

---

### dblclick {/* #page-dblclick */}



:::warningDiscouraged

Use locator-based [Locator.dblclick()](/api/class-locator.mdx#locator-dblclick) instead. Read more about [locators](../locators.mdx).

:::


This method double clicks an element matching [selector](/api/class-page.mdx#page-dblclick-option-selector) by performing the following steps:
1. Find an element matching [selector](/api/class-page.mdx#page-dblclick-option-selector). If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](../actionability.mdx) checks on the matched element, unless [setForce](/api/class-page.mdx#page-dblclick-option-force) option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [Page.mouse()](/api/class-page.mdx#page-mouse) to double click in the center of the element, or the specified [setPosition](/api/class-page.mdx#page-dblclick-option-position).

When all steps combined have not finished during the specified [setTimeout](/api/class-page.mdx#page-dblclick-option-timeout), this method throws a TimeoutError. Passing zero timeout disables this.

:::note

`page.dblclick()` dispatches two `click` events and a single `dblclick` event.
:::

**Usage**

```java
Page.dblclick(selector);
Page.dblclick(selector, options);
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `Page.DblclickOptions` *(optional)*
  - `setButton` `enum MouseButton { LEFT, RIGHT, MIDDLE }` *(optional)*
    
    Defaults to `left`.
  - `setDelay` double *(optional)*
    
    Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `setForce` boolean *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `setModifiers` List<`enum KeyboardModifier { ALT, CONTROL, CONTROLORMETA, META, SHIFT }`> *(optional)*
    
    Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used. "ControlOrMeta" resolves to "Control" on Windows and Linux and to "Meta" on macOS.
  - `setNoWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `setPosition` Position *(optional)*
    - `setX` double
      
      
    - `setY` double
      
      
    A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
  - `setScroll` `enum ScrollMode { AUTO, NONE }` *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `setTrial` boolean *(optional)* 
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it. Note that keyboard `modifiers` will be pressed regardless of `trial` to allow testing elements which are only visible when those keys are pressed.

**Returns**
- void

---

### dispatchEvent {/* #page-dispatch-event */}



:::warningDiscouraged

Use locator-based [Locator.dispatchEvent()](/api/class-locator.mdx#locator-dispatch-event) instead. Read more about [locators](../locators.mdx).

:::


The snippet below dispatches the `click` event on the element. Regardless of the visibility state of the element, `click` is dispatched. This is equivalent to calling [element.click()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click).

**Usage**

```java
page.dispatchEvent("button#submit", "click");
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

```java
// Note you can only create DataTransfer in Chromium and Firefox
JSHandle dataTransfer = page.evaluateHandle("() => new DataTransfer()");
Map<String, Object> arg = new HashMap<>();
arg.put("dataTransfer", dataTransfer);
page.dispatchEvent("#source", "dragstart", arg);
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `type` String
  
  DOM event type: `"click"`, `"dragstart"`, etc.
- `eventInit` EvaluationArgument *(optional)*
  
  Optional event-specific initialization properties.
- `options` `Page.DispatchEventOptions` *(optional)*
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- void

---

### evalOnSelector {/* #page-eval-on-selector */}



:::warningDiscouraged

This method does not wait for the element to pass actionability checks and therefore can lead to the flaky tests. Use [Locator.evaluate()](/api/class-locator.mdx#locator-evaluate), other Locator helper methods or web-first assertions instead.

:::


The method finds an element matching the specified selector within the page and passes it as a first argument to [expression](/api/class-page.mdx#page-eval-on-selector-option-expression). If no elements match the selector, the method throws an error. Returns the value of [expression](/api/class-page.mdx#page-eval-on-selector-option-expression).

If [expression](/api/class-page.mdx#page-eval-on-selector-option-expression) returns a Promise, then [Page.evalOnSelector()](/api/class-page.mdx#page-eval-on-selector) would wait for the promise to resolve and return its value.

**Usage**

```java
String searchValue = (String) page.evalOnSelector("#search", "el => el.value");
String preloadHref = (String) page.evalOnSelector("linkrel=preload", "el => el.href");
String html = (String) page.evalOnSelector(".main-container", "(e, suffix) => e.outerHTML + suffix", "hello");
```

**Arguments**
- `selector` String
  
  A selector to query for.
- `expression` String
  
  JavaScript expression to be evaluated in the browser context. If the expression evaluates to a function, the function is automatically invoked.
- `arg` EvaluationArgument *(optional)*
  
  Optional argument to pass to [expression](/api/class-page.mdx#page-eval-on-selector-option-expression).
- `options` `Page.EvalOnSelectorOptions` *(optional)*
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.

**Returns**
- Object

---

### evalOnSelectorAll {/* #page-eval-on-selector-all */}



:::warningDiscouraged

In most cases, [Locator.evaluateAll()](/api/class-locator.mdx#locator-evaluate-all), other Locator helper methods and web-first assertions do a better job.

:::


The method finds all elements matching the specified selector within the page and passes an array of matched elements as a first argument to [expression](/api/class-page.mdx#page-eval-on-selector-all-option-expression). Returns the result of [expression](/api/class-page.mdx#page-eval-on-selector-all-option-expression) invocation.

If [expression](/api/class-page.mdx#page-eval-on-selector-all-option-expression) returns a Promise, then [Page.evalOnSelectorAll()](/api/class-page.mdx#page-eval-on-selector-all) would wait for the promise to resolve and return its value.

**Usage**

```java
boolean divCounts = (boolean) page.evalOnSelectorAll("div", "(divs, min) => divs.length >= min", 10);
```

**Arguments**
- `selector` String
  
  A selector to query for.
- `expression` String
  
  JavaScript expression to be evaluated in the browser context. If the expression evaluates to a function, the function is automatically invoked.
- `arg` EvaluationArgument *(optional)*
  
  Optional argument to pass to [expression](/api/class-page.mdx#page-eval-on-selector-all-option-expression).

**Returns**
- Object

---

### fill {/* #page-fill */}



:::warningDiscouraged

Use locator-based [Locator.fill()](/api/class-locator.mdx#locator-fill) instead. Read more about [locators](../locators.mdx).

:::


This method waits for an element matching [selector](/api/class-page.mdx#page-fill-option-selector), waits for [actionability](../actionability.mdx) checks, focuses the element, fills it and triggers an `input` event after filling. Note that you can pass an empty string to clear the input field.

If the target element is not an `<input>`, `<textarea>` or `contenteditable` element, this method throws an error. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), the control will be filled instead.

To send fine-grained keyboard events, use [Locator.pressSequentially()](/api/class-locator.mdx#locator-press-sequentially).

**Usage**

```java
Page.fill(selector, value);
Page.fill(selector, value, options);
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `value` String
  
  Value to fill for the `<input>`, `<textarea>` or `contenteditable` element.
- `options` `Page.FillOptions` *(optional)*
  - `setForce` boolean *(optional)* 
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `setNoWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- void

---

### focus {/* #page-focus */}



:::warningDiscouraged

Use locator-based [Locator.focus()](/api/class-locator.mdx#locator-focus) instead. Read more about [locators](../locators.mdx).

:::


This method fetches an element with [selector](/api/class-page.mdx#page-focus-option-selector) and focuses it. If there's no element matching [selector](/api/class-page.mdx#page-focus-option-selector), the method waits until a matching element appears in the DOM.

**Usage**

```java
Page.focus(selector);
Page.focus(selector, options);
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `Page.FocusOptions` *(optional)*
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- void

---

### getAttribute {/* #page-get-attribute */}



:::warningDiscouraged

Use locator-based [Locator.getAttribute()](/api/class-locator.mdx#locator-get-attribute) instead. Read more about [locators](../locators.mdx).

:::


Returns element attribute value.

**Usage**

```java
Page.getAttribute(selector, name);
Page.getAttribute(selector, name, options);
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `name` String
  
  Attribute name to get the value for.
- `options` `Page.GetAttributeOptions` *(optional)*
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- null | String

---

### hover {/* #page-hover */}



:::warningDiscouraged

Use locator-based [Locator.hover()](/api/class-locator.mdx#locator-hover) instead. Read more about [locators](../locators.mdx).

:::


This method hovers over an element matching [selector](/api/class-page.mdx#page-hover-option-selector) by performing the following steps:
1. Find an element matching [selector](/api/class-page.mdx#page-hover-option-selector). If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](../actionability.mdx) checks on the matched element, unless [setForce](/api/class-page.mdx#page-hover-option-force) option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [Page.mouse()](/api/class-page.mdx#page-mouse) to hover over the center of the element, or the specified [setPosition](/api/class-page.mdx#page-hover-option-position).

When all steps combined have not finished during the specified [setTimeout](/api/class-page.mdx#page-hover-option-timeout), this method throws a TimeoutError. Passing zero timeout disables this.

**Usage**

```java
Page.hover(selector);
Page.hover(selector, options);
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `Page.HoverOptions` *(optional)*
  - `setForce` boolean *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `setModifiers` List<`enum KeyboardModifier { ALT, CONTROL, CONTROLORMETA, META, SHIFT }`> *(optional)*
    
    Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used. "ControlOrMeta" resolves to "Control" on Windows and Linux and to "Meta" on macOS.
  - `setNoWaitAfter` boolean *(optional)* 
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `setPosition` Position *(optional)*
    - `setX` double
      
      
    - `setY` double
      
      
    A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
  - `setScroll` `enum ScrollMode { AUTO, NONE }` *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `setTrial` boolean *(optional)* 
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it. Note that keyboard `modifiers` will be pressed regardless of `trial` to allow testing elements which are only visible when those keys are pressed.

**Returns**
- void

---

### innerHTML {/* #page-inner-html */}



:::warningDiscouraged

Use locator-based [Locator.innerHTML()](/api/class-locator.mdx#locator-inner-html) instead. Read more about [locators](../locators.mdx).

:::


Returns `element.innerHTML`.

**Usage**

```java
Page.innerHTML(selector);
Page.innerHTML(selector, options);
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `Page.InnerHTMLOptions` *(optional)*
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- String

---

### innerText {/* #page-inner-text */}



:::warningDiscouraged

Use locator-based [Locator.innerText()](/api/class-locator.mdx#locator-inner-text) instead. Read more about [locators](../locators.mdx).

:::


Returns `element.innerText`.

**Usage**

```java
Page.innerText(selector);
Page.innerText(selector, options);
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `Page.InnerTextOptions` *(optional)*
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- String

---

### inputValue {/* #page-input-value */}



:::warningDiscouraged

Use locator-based [Locator.inputValue()](/api/class-locator.mdx#locator-input-value) instead. Read more about [locators](../locators.mdx).

:::


Returns `input.value` for the selected `<input>` or `<textarea>` or `<select>` element.

Throws for non-input elements. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), returns the value of the control.

**Usage**

```java
Page.inputValue(selector);
Page.inputValue(selector, options);
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `Page.InputValueOptions` *(optional)*
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- String

---

### isChecked {/* #page-is-checked */}



:::warningDiscouraged

Use locator-based [Locator.isChecked()](/api/class-locator.mdx#locator-is-checked) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is checked. Throws if the element is not a checkbox or radio input.

**Usage**

```java
Page.isChecked(selector);
Page.isChecked(selector, options);
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `Page.IsCheckedOptions` *(optional)*
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- boolean

---

### isDisabled {/* #page-is-disabled */}



:::warningDiscouraged

Use locator-based [Locator.isDisabled()](/api/class-locator.mdx#locator-is-disabled) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is disabled, the opposite of [enabled](../actionability.mdx#enabled).

**Usage**

```java
Page.isDisabled(selector);
Page.isDisabled(selector, options);
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `Page.IsDisabledOptions` *(optional)*
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- boolean

---

### isEditable {/* #page-is-editable */}



:::warningDiscouraged

Use locator-based [Locator.isEditable()](/api/class-locator.mdx#locator-is-editable) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is [editable](../actionability.mdx#editable).

**Usage**

```java
Page.isEditable(selector);
Page.isEditable(selector, options);
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `Page.IsEditableOptions` *(optional)*
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- boolean

---

### isEnabled {/* #page-is-enabled */}



:::warningDiscouraged

Use locator-based [Locator.isEnabled()](/api/class-locator.mdx#locator-is-enabled) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is [enabled](../actionability.mdx#enabled).

**Usage**

```java
Page.isEnabled(selector);
Page.isEnabled(selector, options);
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `Page.IsEnabledOptions` *(optional)*
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- boolean

---

### isHidden {/* #page-is-hidden */}



:::warningDiscouraged

Use locator-based [Locator.isHidden()](/api/class-locator.mdx#locator-is-hidden) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is hidden, the opposite of [visible](../actionability.mdx#visible).  [selector](/api/class-page.mdx#page-is-hidden-option-selector) that does not match any elements is considered hidden.

**Usage**

```java
Page.isHidden(selector);
Page.isHidden(selector, options);
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `Page.IsHiddenOptions` *(optional)*
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    :::warningDeprecated
    This option is ignored. [Page.isHidden()](/api/class-page.mdx#page-is-hidden) does not wait for the element to become hidden and returns immediately.
    :::
    

**Returns**
- boolean

---

### isVisible {/* #page-is-visible */}



:::warningDiscouraged

Use locator-based [Locator.isVisible()](/api/class-locator.mdx#locator-is-visible) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is [visible](../actionability.mdx#visible). [selector](/api/class-page.mdx#page-is-visible-option-selector) that does not match any elements is considered not visible.

**Usage**

```java
Page.isVisible(selector);
Page.isVisible(selector, options);
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `Page.IsVisibleOptions` *(optional)*
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    :::warningDeprecated
    This option is ignored. [Page.isVisible()](/api/class-page.mdx#page-is-visible) does not wait for the element to become visible and returns immediately.
    :::
    

**Returns**
- boolean

---

### press {/* #page-press */}



:::warningDiscouraged

Use locator-based [Locator.press()](/api/class-locator.mdx#locator-press) instead. Read more about [locators](../locators.mdx).

:::


Focuses the element, and then uses [Keyboard.down()](/api/class-keyboard.mdx#keyboard-down) and [Keyboard.up()](/api/class-keyboard.mdx#keyboard-up).

[key](/api/class-page.mdx#page-press-option-key) can specify the intended [keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) value or a single character to generate the text for. A superset of the [key](/api/class-page.mdx#page-press-option-key) values can be found [here](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values). Examples of the keys are:

`F1` - `F12`, `Digit0`- `Digit9`, `KeyA`- `KeyZ`, `Backquote`, `Minus`, `Equal`, `Backslash`, `Backspace`, `Tab`, `Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`, `PageDown`, `PageUp`, `ArrowRight`, `ArrowUp`, etc.

Following modification shortcuts are also supported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`, `ControlOrMeta`. `ControlOrMeta` resolves to `Control` on Windows and Linux and to `Meta` on macOS.

Holding down `Shift` will type the text that corresponds to the [key](/api/class-page.mdx#page-press-option-key) in the upper case.

If [key](/api/class-page.mdx#page-press-option-key) is a single character, it is case-sensitive, so the values `a` and `A` will generate different respective texts.

Shortcuts such as `key: "Control+o"`, `key: "Control++` or `key: "Control+Shift+T"` are supported as well. When specified with the modifier, modifier is pressed and being held while the subsequent key is being pressed.

**Usage**

```java
Page page = browser.newPage();
page.navigate("https://keycode.info");
page.press("body", "A");
page.screenshot(new Page.ScreenshotOptions().setPath(Paths.get("A.png")));
page.press("body", "ArrowLeft");
page.screenshot(new Page.ScreenshotOptions().setPath(Paths.get("ArrowLeft.png" )));
page.press("body", "Shift+O");
page.screenshot(new Page.ScreenshotOptions().setPath(Paths.get("O.png" )));
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `key` String
  
  Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.
- `options` `Page.PressOptions` *(optional)*
  - `setDelay` double *(optional)*
    
    Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.
  - `setNoWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option will default to `true` in the future.
    :::
    
    
    Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- void

---

### querySelector {/* #page-query-selector */}



:::warningDiscouraged

Use locator-based [Page.locator()](/api/class-page.mdx#page-locator) instead. Read more about [locators](../locators.mdx).

:::


The method finds an element matching the specified selector within the page. If no elements match the selector, the return value resolves to `null`. To wait for an element on the page, use [Locator.waitFor()](/api/class-locator.mdx#locator-wait-for).

**Usage**

```java
Page.querySelector(selector);
Page.querySelector(selector, options);
```

**Arguments**
- `selector` String
  
  A selector to query for.
- `options` `Page.QuerySelectorOptions` *(optional)*
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.

**Returns**
- null | ElementHandle

---

### querySelectorAll {/* #page-query-selector-all */}



:::warningDiscouraged

Use locator-based [Page.locator()](/api/class-page.mdx#page-locator) instead. Read more about [locators](../locators.mdx).

:::


The method finds all elements matching the specified selector within the page. If no elements match the selector, the return value resolves to `[]`.

**Usage**

```java
Page.querySelectorAll(selector);
```

**Arguments**
- `selector` String
  
  A selector to query for.

**Returns**
- List<ElementHandle>

---

### selectOption {/* #page-select-option */}



:::warningDiscouraged

Use locator-based [Locator.selectOption()](/api/class-locator.mdx#locator-select-option) instead. Read more about [locators](../locators.mdx).

:::


This method waits for an element matching [selector](/api/class-page.mdx#page-select-option-option-selector), waits for [actionability](../actionability.mdx) checks, waits until all specified options are present in the `<select>` element and selects these options.

If the target element is not a `<select>` element, this method throws an error. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), the control will be used instead.

Returns the array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected.

**Usage**

```java
// Single selection matching the value or label
page.selectOption("select#colors", "blue");
// single selection matching both the value and the label
page.selectOption("select#colors", new SelectOption().setLabel("Blue"));
// multiple selection
page.selectOption("select#colors", new String[] {"red", "green", "blue"});
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `values` null | String | ElementHandle | String&#91;&#93; | `SelectOption` | ElementHandle&#91;&#93; | `SelectOption`&#91;&#93;
  - `setValue` String *(optional)*
    
    Matches by `option.value`. Optional.
  - `setLabel` String *(optional)*
    
    Matches by `option.label`. Optional.
  - `setIndex` int *(optional)*
    
    Matches by the index. Optional.
  
  Options to select. If the `<select>` has the `multiple` attribute, all matching options are selected, otherwise only the first option matching one of the passed options is selected. String values are matching both values and labels. Option is considered matching if all specified properties match.
- `options` `Page.SelectOptionOptions` *(optional)*
  - `setForce` boolean *(optional)* 
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `setNoWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- List<String>

---

### setChecked {/* #page-set-checked */}



:::warningDiscouraged

Use locator-based [Locator.setChecked()](/api/class-locator.mdx#locator-set-checked) instead. Read more about [locators](../locators.mdx).

:::


This method checks or unchecks an element matching [selector](/api/class-page.mdx#page-set-checked-option-selector) by performing the following steps:
1. Find an element matching [selector](/api/class-page.mdx#page-set-checked-option-selector). If there is none, wait until a matching element is attached to the DOM.
1. Ensure that matched element is a checkbox or a radio input. If not, this method throws.
1. If the element already has the right checked state, this method returns immediately.
1. Wait for [actionability](../actionability.mdx) checks on the matched element, unless [setForce](/api/class-page.mdx#page-set-checked-option-force) option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [Page.mouse()](/api/class-page.mdx#page-mouse) to click in the center of the element.
1. Ensure that the element is now checked or unchecked. If not, this method throws.

When all steps combined have not finished during the specified [setTimeout](/api/class-page.mdx#page-set-checked-option-timeout), this method throws a TimeoutError. Passing zero timeout disables this.

**Usage**

```java
Page.setChecked(selector, checked);
Page.setChecked(selector, checked, options);
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `checked` boolean
  
  Whether to check or uncheck the checkbox.
- `options` `Page.SetCheckedOptions` *(optional)*
  - `setForce` boolean *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `setNoWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `setPosition` Position *(optional)*
    - `setX` double
      
      
    - `setY` double
      
      
    A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
  - `setScroll` `enum ScrollMode { AUTO, NONE }` *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `setStrict` boolean *(optional)*
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `setTrial` boolean *(optional)*
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it.

**Returns**
- void

---

### setInputFiles {/* #page-set-input-files */}



:::warningDiscouraged

Use locator-based [Locator.setInputFiles()](/api/class-locator.mdx#locator-set-input-files) instead. Read more about [locators](../locators.mdx).

:::


Sets the value of the file input to these file paths or files. If some of the `filePaths` are relative paths, then they are resolved relative to the current working directory. For empty array, clears the selected files. For inputs with a `webkitdirectory` attribute, only a single directory path is supported.

This method expects [selector](/api/class-page.mdx#page-set-input-files-option-selector) to point to an [input element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input). However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), targets the control instead.

**Usage**

```java
Page.setInputFiles(selector, files);
Page.setInputFiles(selector, files, options);
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `files` Path | Path&#91;&#93; | `FilePayload` | `FilePayload`&#91;&#93;
  - `setName` String
    
    File name
  - `setMimeType` String
    
    File type
  - `setBuffer` byte&#91;&#93;
    
    File content
- `options` `Page.SetInputFilesOptions` *(optional)*
  - `setNoWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- void

---

### tap {/* #page-tap */}



:::warningDiscouraged

Use locator-based [Locator.tap()](/api/class-locator.mdx#locator-tap) instead. Read more about [locators](../locators.mdx).

:::


This method taps an element matching [selector](/api/class-page.mdx#page-tap-option-selector) by performing the following steps:
1. Find an element matching [selector](/api/class-page.mdx#page-tap-option-selector). If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](../actionability.mdx) checks on the matched element, unless [setForce](/api/class-page.mdx#page-tap-option-force) option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [Page.touchscreen()](/api/class-page.mdx#page-touchscreen) to tap the center of the element, or the specified [setPosition](/api/class-page.mdx#page-tap-option-position).

When all steps combined have not finished during the specified [setTimeout](/api/class-page.mdx#page-tap-option-timeout), this method throws a TimeoutError. Passing zero timeout disables this.

:::note

[Page.tap()](/api/class-page.mdx#page-tap) will throw if the [setHasTouch](/api/class-browser.mdx#browser-new-context-option-has-touch) option of the browser context is false.
:::

**Usage**

```java
Page.tap(selector);
Page.tap(selector, options);
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `Page.TapOptions` *(optional)*
  - `setForce` boolean *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `setModifiers` List<`enum KeyboardModifier { ALT, CONTROL, CONTROLORMETA, META, SHIFT }`> *(optional)*
    
    Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used. "ControlOrMeta" resolves to "Control" on Windows and Linux and to "Meta" on macOS.
  - `setNoWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `setPosition` Position *(optional)*
    - `setX` double
      
      
    - `setY` double
      
      
    A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
  - `setScroll` `enum ScrollMode { AUTO, NONE }` *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `setTrial` boolean *(optional)* 
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it. Note that keyboard `modifiers` will be pressed regardless of `trial` to allow testing elements which are only visible when those keys are pressed.

**Returns**
- void

---

### textContent {/* #page-text-content */}



:::warningDiscouraged

Use locator-based [Locator.textContent()](/api/class-locator.mdx#locator-text-content) instead. Read more about [locators](../locators.mdx).

:::


Returns `element.textContent`.

**Usage**

```java
Page.textContent(selector);
Page.textContent(selector, options);
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `Page.TextContentOptions` *(optional)*
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- null | String

---

### type {/* #page-type */}



:::warningDeprecated

In most cases, you should use [Locator.fill()](/api/class-locator.mdx#locator-fill) instead. You only need to press keys one by one if there is special keyboard handling on the page - in this case use [Locator.pressSequentially()](/api/class-locator.mdx#locator-press-sequentially).

:::


Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text. `page.type` can be used to send fine-grained keyboard events. To fill values in form fields, use [Page.fill()](/api/class-page.mdx#page-fill).

To press a special key, like `Control` or `ArrowDown`, use [Keyboard.press()](/api/class-keyboard.mdx#keyboard-press).

**Usage**

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `text` String
  
  A text to type into a focused element.
- `options` `Page.TypeOptions` *(optional)*
  - `setDelay` double *(optional)*
    
    Time to wait between key presses in milliseconds. Defaults to 0.
  - `setNoWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- void

---

### uncheck {/* #page-uncheck */}



:::warningDiscouraged

Use locator-based [Locator.uncheck()](/api/class-locator.mdx#locator-uncheck) instead. Read more about [locators](../locators.mdx).

:::


This method unchecks an element matching [selector](/api/class-page.mdx#page-uncheck-option-selector) by performing the following steps:
1. Find an element matching [selector](/api/class-page.mdx#page-uncheck-option-selector). If there is none, wait until a matching element is attached to the DOM.
1. Ensure that matched element is a checkbox or a radio input. If not, this method throws. If the element is already unchecked, this method returns immediately.
1. Wait for [actionability](../actionability.mdx) checks on the matched element, unless [setForce](/api/class-page.mdx#page-uncheck-option-force) option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [Page.mouse()](/api/class-page.mdx#page-mouse) to click in the center of the element.
1. Ensure that the element is now unchecked. If not, this method throws.

When all steps combined have not finished during the specified [setTimeout](/api/class-page.mdx#page-uncheck-option-timeout), this method throws a TimeoutError. Passing zero timeout disables this.

**Usage**

```java
Page.uncheck(selector);
Page.uncheck(selector, options);
```

**Arguments**
- `selector` String
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `Page.UncheckOptions` *(optional)*
  - `setForce` boolean *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `setNoWaitAfter` boolean *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `setPosition` Position *(optional)* 
    - `setX` double
      
      
    - `setY` double
      
      
    A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
  - `setScroll` `enum ScrollMode { AUTO, NONE }` *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `setTrial` boolean *(optional)* 
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it.

**Returns**
- void

---

### waitForNavigation {/* #page-wait-for-navigation */}



:::warningDeprecated

This method is inherently racy, please use [Page.waitForURL()](/api/class-page.mdx#page-wait-for-url) instead.

:::


Waits for the main frame navigation and returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. In case of navigation to a different anchor or navigation due to History API usage, the navigation will resolve with `null`.

**Usage**

This resolves when the page navigates to a new URL or reloads. It is useful for when you run code which will indirectly cause the page to navigate. e.g. The click target has an `onclick` handler that triggers navigation from a `setTimeout`. Consider this example:

```java
// The method returns after navigation has finished
Response response = page.waitForNavigation(() -> {
  // This action triggers the navigation after a timeout.
  page.getByText("Navigate after timeout").click();
});
```

:::note
Usage of the [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) to change the URL is considered a navigation.
:::

**Arguments**
- `options` `Page.WaitForNavigationOptions` *(optional)*
  - `setTimeout` double *(optional)*
    
    Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [Page.setDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `setUrl` String | Pattern | Predicate<String> *(optional)*
    
    A glob pattern, regex pattern, or predicate receiving URL to match while waiting for the navigation. Note that if the parameter is a string without wildcard characters, the method will wait for navigation to URL that is exactly equal to the string.
  - `setWaitUntil` `enum WaitUntilState { LOAD, DOMCONTENTLOADED, NETWORKIDLE, COMMIT }` *(optional)*
    
    When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
    * `'commit'` - consider operation to be finished when network response is received and the document started loading.
- `callback` Runnable 
  
  Callback that performs the action triggering the event.

**Returns**
- null | Response

---

### waitForSelector {/* #page-wait-for-selector */}



:::warningDiscouraged

Use web assertions that assert visibility or a locator-based [Locator.waitFor()](/api/class-locator.mdx#locator-wait-for) instead. Read more about [locators](../locators.mdx).

:::


Returns when element specified by selector satisfies [setState](/api/class-page.mdx#page-wait-for-selector-option-state) option. Returns `null` if waiting for `hidden` or `detached`.

:::note

Playwright automatically waits for element to be ready before performing an action. Using Locator objects and web-first assertions makes the code wait-for-selector-free.
:::

Wait for the [selector](/api/class-page.mdx#page-wait-for-selector-option-selector) to satisfy [setState](/api/class-page.mdx#page-wait-for-selector-option-state) option (either appear/disappear from dom, or become visible/hidden). If at the moment of calling the method [selector](/api/class-page.mdx#page-wait-for-selector-option-selector) already satisfies the condition, the method will return immediately. If the selector doesn't satisfy the condition for the [setTimeout](/api/class-page.mdx#page-wait-for-selector-option-timeout) milliseconds, the function will throw.

**Usage**

This method works across navigations:

```java
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType chromium = playwright.chromium();
      Browser browser = chromium.launch();
      Page page = browser.newPage();
      for (String currentURL : Arrays.asList("https://google.com", "https://bbc.com")) {
        page.navigate(currentURL);
        ElementHandle element = page.waitForSelector("img");
        System.out.println("Loaded image: " + element.getAttribute("src"));
      }
      browser.close();
    }
  }
}
```

**Arguments**
- `selector` String
  
  A selector to query for.
- `options` `Page.WaitForSelectorOptions` *(optional)*
  - `setState` `enum WaitForSelectorState { ATTACHED, DETACHED, VISIBLE, HIDDEN }` *(optional)*
    
    Defaults to `'visible'`. Can be either:
    * `'attached'` - wait for element to be present in DOM.
    * `'detached'` - wait for element to not be present in DOM.
    * `'visible'` - wait for element to have non-empty bounding box and no `visibility:hidden`. Note that element without any content or with `display:none` has an empty bounding box and is not considered visible.
    * `'hidden'` - wait for element to be either detached from DOM, or have an empty bounding box or `visibility:hidden`. This is opposite to the `'visible'` option.
  - `setStrict` boolean *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `setTimeout` double *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.setDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.setDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- null | ElementHandle

---

### waitForTimeout {/* #page-wait-for-timeout */}



:::warningDiscouraged

Never wait for timeout in production. Tests that wait for time are inherently flaky. Use Locator actions and web assertions that wait automatically.

:::


Waits for the given [timeout](/api/class-page.mdx#page-wait-for-timeout-option-timeout) in milliseconds.

Note that `page.waitForTimeout()` should only be used for debugging. Tests using the timer in production are going to be flaky. Use signals such as network events, selectors becoming visible and others instead.

**Usage**

```java
// wait for 1 second
page.waitForTimeout(1000);
```

**Arguments**
- `timeout` double
  
  A timeout to wait for

**Returns**
- void


APIRequest: /api/class-apirequest.mdx "APIRequest"
APIRequestContext: /api/class-apirequestcontext.mdx "APIRequestContext"
APIResponse: /api/class-apiresponse.mdx "APIResponse"
APIResponseAssertions: /api/class-apiresponseassertions.mdx "APIResponseAssertions"
Browser: /api/class-browser.mdx "Browser"
BrowserContext: /api/class-browsercontext.mdx "BrowserContext"
BrowserType: /api/class-browsertype.mdx "BrowserType"
CDPSession: /api/class-cdpsession.mdx "CDPSession"
Clock: /api/class-clock.mdx "Clock"
ConsoleMessage: /api/class-consolemessage.mdx "ConsoleMessage"
Credentials: /api/class-credentials.mdx "Credentials"
Debugger: /api/class-debugger.mdx "Debugger"
Dialog: /api/class-dialog.mdx "Dialog"
Download: /api/class-download.mdx "Download"
ElementHandle: /api/class-elementhandle.mdx "ElementHandle"
FileChooser: /api/class-filechooser.mdx "FileChooser"
FormData: /api/class-formdata.mdx "FormData"
Frame: /api/class-frame.mdx "Frame"
FrameLocator: /api/class-framelocator.mdx "FrameLocator"
JSHandle: /api/class-jshandle.mdx "JSHandle"
Keyboard: /api/class-keyboard.mdx "Keyboard"
Locator: /api/class-locator.mdx "Locator"
LocatorAssertions: /api/class-locatorassertions.mdx "LocatorAssertions"
Mouse: /api/class-mouse.mdx "Mouse"
Page: /api/class-page.mdx "Page"
PageAssertions: /api/class-pageassertions.mdx "PageAssertions"
Playwright: /api/class-playwright.mdx "Playwright"
PlaywrightAssertions: /api/class-playwrightassertions.mdx "PlaywrightAssertions"
PlaywrightException: /api/class-playwrightexception.mdx "PlaywrightException"
Request: /api/class-request.mdx "Request"
RequestOptions: /api/class-requestoptions.mdx "RequestOptions"
Response: /api/class-response.mdx "Response"
Route: /api/class-route.mdx "Route"
Screencast: /api/class-screencast.mdx "Screencast"
Selectors: /api/class-selectors.mdx "Selectors"
TimeoutError: /api/class-timeouterror.mdx "TimeoutError"
Touchscreen: /api/class-touchscreen.mdx "Touchscreen"
Tracing: /api/class-tracing.mdx "Tracing"
Video: /api/class-video.mdx "Video"
WebError: /api/class-weberror.mdx "WebError"
WebSocket: /api/class-websocket.mdx "WebSocket"
WebSocketFrame: /api/class-websocketframe.mdx "WebSocketFrame"
WebSocketRoute: /api/class-websocketroute.mdx "WebSocketRoute"
WebStorage: /api/class-webstorage.mdx "WebStorage"
Worker: /api/class-worker.mdx "Worker"
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

boolean: https://docs.oracle.com/javase/tutorial/java/nutsandbolts/datatypes.html "boolean"
byte&#91;&#93;: https://docs.oracle.com/javase/tutorial/java/nutsandbolts/datatypes.html "byte[]"
Consumer: https://docs.oracle.com/javase/8/docs/api/java/util/function/Consumer.html "Consumer"
Date: https://docs.oracle.com/javase/8/docs/api/java/util/Date.html "Date"
double: https://docs.oracle.com/javase/tutorial/java/nutsandbolts/datatypes.html "double"
InputStream: https://docs.oracle.com/javase/8/docs/api/java/io/InputStream.html "InputStream"
int: https://docs.oracle.com/javase/tutorial/java/nutsandbolts/datatypes.html "int"
long: https://docs.oracle.com/javase/tutorial/java/nutsandbolts/datatypes.html "long"
JsonObject: https://www.javadoc.io/doc/com.google.code.gson/gson/latest/com.google.gson/com/google/gson/JsonObject.html "JsonObject"
List: https://docs.oracle.com/javase/8/docs/api/java/util/List.html "List"
Map: https://docs.oracle.com/javase/8/docs/api/java/util/Map.html "Map"
null: https://docs.oracle.com/javase/specs/jls/se8/html/jls-3.html#jls-3.10.7 "null"
Object: https://docs.oracle.com/javase/8/docs/api/java/lang/Object.html "Object"
Path: https://docs.oracle.com/javase/8/docs/api/java/nio/file/Path.html "Path"
Pattern: https://docs.oracle.com/javase/8/docs/api/java/util/regex/Pattern.html "Pattern"
Predicate: https://docs.oracle.com/javase/8/docs/api/java/util/function/Predicate.html "Predicate"
void: https://docs.oracle.com/javase/tutorial/java/javaOO/methods.html "void"
Runnable: https://docs.oracle.com/javase/8/docs/api/java/lang/Runnable.html "Runnable"
RuntimeException: https://docs.oracle.com/javase/8/docs/api/java/lang/RuntimeException.html "RuntimeException"
String: https://docs.oracle.com/javase/8/docs/api/java/lang/String.html "String"

all available image tags: https://mcr.microsoft.com/en-us/product/playwright/java/about "all available image tags"
Microsoft Artifact Registry: https://mcr.microsoft.com/en-us/product/playwright/java/about "Microsoft Artifact Registry"
Dockerfile.noble: https://github.com/microsoft/playwright-java/blob/main/utils/docker/Dockerfile.noble "Dockerfile.noble"
