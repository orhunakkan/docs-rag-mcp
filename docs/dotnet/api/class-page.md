# Page

> **Source:** [playwright.dev/dotnet/docs/api/class-page](https://playwright.dev/dotnet/docs/api/class-page)

---

Page provides methods to interact with a single tab in a Browser, or an [extension background page](https://developer.chrome.com/extensions/background_pages) in Chromium. One Browser instance might have multiple Page instances.

This example creates a page, navigates it to a URL, and then saves a screenshot:

```csharp
using Microsoft.Playwright;
using System.Threading.Tasks;

class PageExamples
{
    public static async Task Run()
    {
        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Webkit.LaunchAsync();
        var page = await browser.NewPageAsync();
        await page.GotoAsync("https://www.theverge.com");
        await page.ScreenshotAsync(new() { Path = "theverge.png" });
    }
}
```

The Page class emits various events (described below) which can be handled using any of Node's native [`EventEmitter`](https://nodejs.org/api/events.html#events_class_eventemitter) methods, such as `on`, `once` or `removeListener`.

This example logs a message for a single page `load` event:

```csharp
page.Load += (_, _) => Console.WriteLine("Page loaded!");
```

To unsubscribe from events use the `removeListener` method:

```csharp
void PageLoadHandler(object _, IPage p) {
    Console.WriteLine("Page loaded!");
};

page.Load += PageLoadHandler;
// Do some work...
page.Load -= PageLoadHandler;
```


---

## Methods

### AddInitScriptAsync {/* #page-add-init-script */}



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

```csharp
await Page.AddInitScriptAsync(scriptPath: "./preload.js");
```

:::note
The order of evaluation of multiple scripts installed via [BrowserContext.AddInitScriptAsync()](/api/class-browsercontext.mdx#browser-context-add-init-script) and [Page.AddInitScriptAsync()](/api/class-page.mdx#page-add-init-script) is not defined.
:::

**Arguments**
- `script` string | string
  
  Script to be evaluated in all pages in the browser context.

**Returns**
- Disposable

---

### AddLocatorHandlerAsync {/* #page-add-locator-handler */}



When testing a web page, sometimes unexpected overlays like a "Sign up" dialog appear and block actions you want to automate, e.g. clicking a button. These overlays don't always show up in the same way or at the same time, making them tricky to handle in automated tests.

This method lets you set up a special function, called a handler, that activates when it detects that overlay is visible. The handler's job is to remove the overlay, allowing your test to continue as if the overlay wasn't there.

Things to keep in mind:
* When an overlay is shown predictably, we recommend explicitly waiting for it in your test and dismissing it as a part of your normal test flow, instead of using [Page.AddLocatorHandlerAsync()](/api/class-page.mdx#page-add-locator-handler).
* Playwright checks for the overlay every time before executing or retrying an action that requires an [actionability check](../actionability.mdx), or before performing an auto-waiting assertion check. When overlay is visible, Playwright calls the handler first, and then proceeds with the action/assertion. Note that the handler is only called when you perform an action/assertion - if the overlay becomes visible but you don't perform any actions, the handler will not be triggered.
* After executing the handler, Playwright will ensure that overlay that triggered the handler is not visible anymore. You can opt-out of this behavior with [NoWaitAfter](/api/class-page.mdx#page-add-locator-handler-option-no-wait-after).
* The execution time of the handler counts towards the timeout of the action/assertion that executed the handler. If your handler takes too long, it might cause timeouts.
* You can register multiple handlers. However, only a single handler will be running at a time. Make sure the actions within a handler don't depend on another handler.

:::warning

Running the handler will alter your page state mid-test. For example it will change the currently focused element and move the mouse. Make sure that actions that run after the handler are self-contained and do not rely on the focus and mouse state being unchanged.

For example, consider a test that calls [Locator.FocusAsync()](/api/class-locator.mdx#locator-focus) followed by [Keyboard.PressAsync()](/api/class-keyboard.mdx#keyboard-press). If your handler clicks a button between these two actions, the focused element most likely will be wrong, and key press will happen on the unexpected element. Use [Locator.PressAsync()](/api/class-locator.mdx#locator-press) instead to avoid this problem.

Another example is a series of mouse actions, where [Mouse.MoveAsync()](/api/class-mouse.mdx#mouse-move) is followed by [Mouse.DownAsync()](/api/class-mouse.mdx#mouse-down). Again, when the handler runs between these two actions, the mouse position will be wrong during the mouse down. Prefer self-contained actions like [Locator.ClickAsync()](/api/class-locator.mdx#locator-click) that do not rely on the state being unchanged by a handler.
:::

**Usage**

An example that closes a "Sign up to the newsletter" dialog when it appears:

```csharp
// Setup the handler.
await page.AddLocatorHandlerAsync(page.GetByText("Sign up to the newsletter"), async () => {
  await page.GetByRole(AriaRole.Button, new() { Name = "No thanks" }).ClickAsync();
});

// Write the test as usual.
await page.GotoAsync("https://example.com");
await page.GetByRole("button", new() { Name = "Start here" }).ClickAsync();
```

An example that skips the "Confirm your security details" page when it is shown:

```csharp
// Setup the handler.
await page.AddLocatorHandlerAsync(page.GetByText("Confirm your security details"), async () => {
  await page.GetByRole(AriaRole.Button, new() { Name = "Remind me later" }).ClickAsync();
});

// Write the test as usual.
await page.GotoAsync("https://example.com");
await page.GetByRole("button", new() { Name = "Start here" }).ClickAsync();
```

An example with a custom callback on every actionability check. It uses a `<body>` locator that is always visible, so the handler is called before every actionability check. It is important to specify [NoWaitAfter](/api/class-page.mdx#page-add-locator-handler-option-no-wait-after), because the handler does not hide the `<body>` element.

```csharp
// Setup the handler.
await page.AddLocatorHandlerAsync(page.Locator("body"), async () => {
  await page.EvaluateAsync("window.removeObstructionsForTestIfNeeded()");
}, new() { NoWaitAfter = true });

// Write the test as usual.
await page.GotoAsync("https://example.com");
await page.GetByRole("button", new() { Name = "Start here" }).ClickAsync();
```

Handler takes the original locator as an argument. You can also automatically remove the handler after a number of invocations by setting [Times](/api/class-page.mdx#page-add-locator-handler-option-times):

```csharp
await page.AddLocatorHandlerAsync(page.GetByText("Sign up to the newsletter"), async locator => {
  await locator.ClickAsync();
}, new() { Times = 1 });
```

**Arguments**
- `locator` Locator
  
  Locator that triggers the handler.
- `handler` Func<Locator, Task>
  
  Function that should be run once [locator](/api/class-page.mdx#page-add-locator-handler-option-locator) appears. This function should get rid of the element that blocks actions like click.
- `options` `PageAddLocatorHandlerOptions?` *(optional)*
  - `NoWaitAfter` bool? *(optional)* 
    
    By default, after calling the handler Playwright will wait until the overlay becomes hidden, and only then Playwright will continue with the action/assertion that triggered the handler. This option allows to opt-out of this behavior, so that overlay can stay visible after the handler has run.
  - `Times` int? *(optional)* 
    
    Specifies the maximum number of times this handler should be called. Unlimited by default.

**Returns**
- void

---

### AddScriptTagAsync {/* #page-add-script-tag */}



Adds a `<script>` tag into the page with the desired url or content. Returns the added tag when the script's onload fires or when the script content was injected into frame.

**Usage**

```csharp
await Page.AddScriptTagAsync(options);
```

**Arguments**
- `options` `PageAddScriptTagOptions?` *(optional)*
  - `Content` string? *(optional)*
    
    Raw JavaScript content to be injected into frame.
  - `Path` string? *(optional)*
    
    Path to the JavaScript file to be injected into frame. If `path` is a relative path, then it is resolved relative to the current working directory.
  - `Type` string? *(optional)*
    
    Script type. Use 'module' in order to load a JavaScript ES6 module. See [script](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script) for more details.
  - `Url` string? *(optional)*
    
    URL of a script to be added.

**Returns**
- ElementHandle

---

### AddStyleTagAsync {/* #page-add-style-tag */}



Adds a `<link rel="stylesheet">` tag into the page with the desired url or a `<style type="text/css">` tag with the content. Returns the added tag when the stylesheet's onload fires or when the CSS content was injected into frame.

**Usage**

```csharp
await Page.AddStyleTagAsync(options);
```

**Arguments**
- `options` `PageAddStyleTagOptions?` *(optional)*
  - `Content` string? *(optional)*
    
    Raw CSS content to be injected into frame.
  - `Path` string? *(optional)*
    
    Path to the CSS file to be injected into frame. If `path` is a relative path, then it is resolved relative to the current working directory.
  - `Url` string? *(optional)*
    
    URL of the `<link>` tag.

**Returns**
- ElementHandle

---

### AriaSnapshotAsync {/* #page-aria-snapshot */}



Captures the aria snapshot of the page. Read more about [aria snapshots](../aria-snapshots.mdx).

**Usage**

```csharp
await Page.AriaSnapshotAsync(options);
```

**Arguments**
- `options` `PageAriaSnapshotOptions?` *(optional)*
  - `Boxes` bool? *(optional)* 
    
    When `true`, appends each element's bounding box as `box=x,y,width,height` to the snapshot. Coordinates are relative to the viewport, in CSS pixels, as returned by [`Element.getBoundingClientRect()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect). Defaults to `false`.
  - `Depth` int? *(optional)*
    
    When specified, limits the depth of the snapshot.
  - `Mode` `enum AriaSnapshotMode { Ai, Default }?` *(optional)*
    
    When set to `"ai"`, returns a snapshot optimized for AI consumption: including element references like `ref=e2` and snapshots of `<iframe>`s. Defaults to `"default"`.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- string

---

### BringToFrontAsync {/* #page-bring-to-front */}



Brings page to front (activates tab).

**Usage**

```csharp
await Page.BringToFrontAsync();
```

**Returns**
- void

---

### CancelPickLocatorAsync {/* #page-cancel-pick-locator */}



Cancels an ongoing [Page.PickLocatorAsync()](/api/class-page.mdx#page-pick-locator) call by deactivating pick locator mode. If no pick locator mode is active, this method is a no-op.

**Usage**

```csharp
await Page.CancelPickLocatorAsync();
```

**Returns**
- void

---

### ClearConsoleMessagesAsync {/* #page-clear-console-messages */}



Clears all stored console messages from this page. Subsequent calls to [Page.ConsoleMessagesAsync()](/api/class-page.mdx#page-console-messages) will only return messages logged after the clear.

**Usage**

```csharp
await Page.ClearConsoleMessagesAsync();
```

**Returns**
- void

---

### ClearPageErrorsAsync {/* #page-clear-page-errors */}



Clears all stored page errors from this page. Subsequent calls to [Page.PageErrorsAsync()](/api/class-page.mdx#page-page-errors) will only return errors thrown after the clear.

**Usage**

```csharp
await Page.ClearPageErrorsAsync();
```

**Returns**
- void

---

### CloseAsync {/* #page-close */}



If [RunBeforeUnload](/api/class-page.mdx#page-close-option-run-before-unload) is `false`, does not run any unload handlers and waits for the page to be closed. If [RunBeforeUnload](/api/class-page.mdx#page-close-option-run-before-unload) is `true` the method will run unload handlers, but will **not** wait for the page to close.

By default, `page.close()` **does not** run `beforeunload` handlers.

:::note

if [RunBeforeUnload](/api/class-page.mdx#page-close-option-run-before-unload) is passed as true, a `beforeunload` dialog might be summoned and should be handled manually via [Page.Dialog](/api/class-page.mdx#page-event-dialog) event.
:::

**Usage**

```csharp
await Page.CloseAsync(options);
```

**Arguments**
- `options` `PageCloseOptions?` *(optional)*
  - `Reason` string? *(optional)* 
    
    The reason to be reported to the operations interrupted by the page closure.
  - `RunBeforeUnload` bool? *(optional)*
    
    Defaults to `false`. Whether to run the [before unload](https://developer.mozilla.org/en-US/docs/Web/Events/beforeunload) page handlers.

**Returns**
- void

---

### ConsoleMessagesAsync {/* #page-console-messages */}



Returns up to (currently) 200 last console messages from this page. See [Page.Console](/api/class-page.mdx#page-event-console) for more details.

**Usage**

```csharp
await Page.ConsoleMessagesAsync(options);
```

**Arguments**
- `options` `PageConsoleMessagesOptions?` *(optional)*
  - `Filter` `enum ConsoleMessagesFilter { All, SinceNavigation }?` *(optional)* 
    
    Controls which messages are returned:

**Returns**
- IReadOnlyList<ConsoleMessage>

---

### ContentAsync {/* #page-content */}



Gets the full HTML contents of the page, including the doctype.

**Usage**

```csharp
await Page.ContentAsync();
```

**Returns**
- string

---

### Context {/* #page-context */}



Get the browser context that the page belongs to.

**Usage**

```csharp
Page.Context
```

**Returns**
- BrowserContext

---

### DragAndDropAsync {/* #page-drag-and-drop */}



This method drags the source element to the target element. It will first move to the source element, perform a `mousedown`, then move to the target element and perform a `mouseup`.

**Usage**

```csharp
await Page.DragAndDropAsync("#source", "#target");
// or specify exact positions relative to the top-left corners of the elements:
await Page.DragAndDropAsync("#source", "#target", new()
{
    SourcePosition = new() { X = 34, Y = 7 },
    TargetPosition = new() { X = 10, Y = 20 },
});
```

**Arguments**
- `source` string
  
  A selector to search for an element to drag. If there are multiple elements satisfying the selector, the first will be used.
- `target` string
  
  A selector to search for an element to drop onto. If there are multiple elements satisfying the selector, the first will be used.
- `options` `PageDragAndDropOptions?` *(optional)*
  - `Force` bool? *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `NoWaitAfter` bool? *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `Scroll` `enum ScrollMode { Auto, None }?` *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `SourcePosition` SourcePosition? *(optional)* 
    - `X` float
      
      
    - `Y` float
      
      
    Clicks on the source element at this point relative to the top-left corner of the element's padding box. If not specified, some visible point of the element is used.
  - `Steps` int? *(optional)* 
    
    Defaults to 1. Sends `n` interpolated `mousemove` events to represent travel between the `mousedown` and `mouseup` of the drag. When set to 1, emits a single `mousemove` event at the destination location.
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `TargetPosition` TargetPosition? *(optional)* 
    - `X` float
      
      
    - `Y` float
      
      
    Drops on the target element at this point relative to the top-left corner of the element's padding box. If not specified, some visible point of the element is used.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `Trial` bool? *(optional)*
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it.

**Returns**
- void

---

### EmulateMediaAsync {/* #page-emulate-media */}



This method changes the `CSS media type` through the `media` argument, and/or the `'prefers-colors-scheme'` media feature, using the `colorScheme` argument.

**Usage**

```csharp
await page.EvaluateAsync("() => matchMedia('screen').matches");
// → true
await page.EvaluateAsync("() => matchMedia('print').matches");
// → false

await page.EmulateMediaAsync(new() { Media = Media.Print });
await page.EvaluateAsync("() => matchMedia('screen').matches");
// → false
await page.EvaluateAsync("() => matchMedia('print').matches");
// → true

await page.EmulateMediaAsync(new() { Media = Media.Screen });
await page.EvaluateAsync("() => matchMedia('screen').matches");
// → true
await page.EvaluateAsync("() => matchMedia('print').matches");
// → false
```

```csharp
await page.EmulateMediaAsync(new() { ColorScheme = ColorScheme.Dark });
await page.EvaluateAsync("matchMedia('(prefers-color-scheme: dark)').matches");
// → true
await page.EvaluateAsync("matchMedia('(prefers-color-scheme: light)').matches");
// → false
```

**Arguments**
- `options` `PageEmulateMediaOptions?` *(optional)*
  - `ColorScheme` `enum ColorScheme { Light, Dark, NoPreference, Null }?` *(optional)* 
    
    Emulates [prefers-colors-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme) media feature, supported values are `'light'` and `'dark'`. Passing `'Null'` disables color scheme emulation. `'no-preference'` is deprecated.
  - `Contrast` `enum Contrast { NoPreference, More, Null }?` *(optional)* 
  - `ForcedColors` `enum ForcedColors { Active, None, Null }?` *(optional)* 
  - `Media` `enum Media { Screen, Print, Null }?` *(optional)* 
    
    Changes the CSS media type of the page. The only allowed values are `'Screen'`, `'Print'` and `'Null'`. Passing `'Null'` disables CSS media emulation.
  - `ReducedMotion` `enum ReducedMotion { Reduce, NoPreference, Null }?` *(optional)* 
    
    Emulates `'prefers-reduced-motion'` media feature, supported values are `'reduce'`, `'no-preference'`. Passing `null` disables reduced motion emulation.

**Returns**
- void

---

### EvaluateAsync {/* #page-evaluate */}



Returns the value of the [expression](/api/class-page.mdx#page-evaluate-option-expression) invocation.

If the function passed to the [Page.EvaluateAsync()](/api/class-page.mdx#page-evaluate) returns a Promise, then [Page.EvaluateAsync()](/api/class-page.mdx#page-evaluate) would wait for the promise to resolve and return its value.

If the function passed to the [Page.EvaluateAsync()](/api/class-page.mdx#page-evaluate) returns a non-Serializable value, then [Page.EvaluateAsync()](/api/class-page.mdx#page-evaluate) resolves to `undefined`. Playwright also supports transferring some additional values that are not serializable by `JSON`: `-0`, `NaN`, `Infinity`, `-Infinity`.

**Usage**

Passing argument to [expression](/api/class-page.mdx#page-evaluate-option-expression):

```csharp
var result = await page.EvaluateAsync<int>("(x, y) => Promise.resolve(x * y)", new[] { 7, 8 });
Console.WriteLine(result);
```

A string can also be passed in instead of a function:

```csharp
Console.WriteLine(await page.EvaluateAsync<int>("1 + 2")); // prints "3"
```

ElementHandle instances can be passed as an argument to the [Page.EvaluateAsync()](/api/class-page.mdx#page-evaluate):

```csharp
var bodyHandle = await page.EvaluateHandleAsync("document.body");
var html = await page.EvaluateAsync<string>("(body, suffix) => body.innerHTML + suffix", new object [] { bodyHandle, "hello" });
await bodyHandle.DisposeAsync();
```

**Arguments**
- `expression` string
  
  JavaScript expression to be evaluated in the browser context. If the expression evaluates to a function, the function is automatically invoked.
- `arg` EvaluationArgument? *(optional)*
  
  Optional argument to pass to [expression](/api/class-page.mdx#page-evaluate-option-expression).

**Returns**
- object

---

### EvaluateHandleAsync {/* #page-evaluate-handle */}



Returns the value of the [expression](/api/class-page.mdx#page-evaluate-handle-option-expression) invocation as a JSHandle.

The only difference between [Page.EvaluateAsync()](/api/class-page.mdx#page-evaluate) and [Page.EvaluateHandleAsync()](/api/class-page.mdx#page-evaluate-handle) is that [Page.EvaluateHandleAsync()](/api/class-page.mdx#page-evaluate-handle) returns JSHandle.

If the function passed to the [Page.EvaluateHandleAsync()](/api/class-page.mdx#page-evaluate-handle) returns a Promise, then [Page.EvaluateHandleAsync()](/api/class-page.mdx#page-evaluate-handle) would wait for the promise to resolve and return its value.

**Usage**

```csharp
// Handle for the window object.
var aWindowHandle = await page.EvaluateHandleAsync("() => Promise.resolve(window)");
```

A string can also be passed in instead of a function:

```csharp
var docHandle = await page.EvaluateHandleAsync("document"); // Handle for the `document`
```

JSHandle instances can be passed as an argument to the [Page.EvaluateHandleAsync()](/api/class-page.mdx#page-evaluate-handle):

```csharp
var handle = await page.EvaluateHandleAsync("() => document.body");
var resultHandle = await page.EvaluateHandleAsync("(body, suffix) => body.innerHTML + suffix", new object[] { handle, "hello" });
Console.WriteLine(await resultHandle.JsonValueAsync<string>());
await resultHandle.DisposeAsync();
```

**Arguments**
- `expression` string
  
  JavaScript expression to be evaluated in the browser context. If the expression evaluates to a function, the function is automatically invoked.
- `arg` EvaluationArgument? *(optional)*
  
  Optional argument to pass to [expression](/api/class-page.mdx#page-evaluate-handle-option-expression).

**Returns**
- JSHandle

---

### ExposeBindingAsync {/* #page-expose-binding */}



The method adds a function called [name](/api/class-page.mdx#page-expose-binding-option-name) on the `window` object of every frame in this page. When called, the function executes [callback](/api/class-page.mdx#page-expose-binding-option-callback) and returns a Promise which resolves to the return value of [callback](/api/class-page.mdx#page-expose-binding-option-callback). If the [callback](/api/class-page.mdx#page-expose-binding-option-callback) returns a Promise, it will be awaited.

The first argument of the [callback](/api/class-page.mdx#page-expose-binding-option-callback) function contains information about the caller: `{ browserContext: BrowserContext, page: Page, frame: Frame }`.

See [BrowserContext.ExposeBindingAsync()](/api/class-browsercontext.mdx#browser-context-expose-binding) for the context-wide version.

:::note

Functions installed via [Page.ExposeBindingAsync()](/api/class-page.mdx#page-expose-binding) survive navigations.
:::

**Usage**

An example of exposing page URL to all frames in a page:

```csharp
using Microsoft.Playwright;
using System.Threading.Tasks;

class PageExamples
{
    public static async Task Main()
    {
        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Webkit.LaunchAsync(new()
        {
            Headless = false,
        });
        var page = await browser.NewPageAsync();

        await page.ExposeBindingAsync("pageUrl", (source) => source.Page.Url);
        await page.SetContentAsync("<script>\n" +
        "  async function onClick() {\n" +
        "    document.querySelector('div').textContent = await window.pageURL();\n" +
        "  }\n" +
        "</script>\n" +
        "<button onclick=\"onClick()\">Click me</button>\n" +
        "<div></div>");

        await page.ClickAsync("button");
    }
}
```

**Arguments**
- `name` string
  
  Name of the function on the window object.
- `callback` Action<BindingSource, T, TResult>
  
  Callback function that will be called in the Playwright's context.

**Returns**
- Disposable

---

### ExposeFunctionAsync {/* #page-expose-function */}



The method adds a function called [name](/api/class-page.mdx#page-expose-function-option-name) on the `window` object of every frame in the page. When called, the function executes [callback](/api/class-page.mdx#page-expose-function-option-callback) and returns a Promise which resolves to the return value of [callback](/api/class-page.mdx#page-expose-function-option-callback).

If the [callback](/api/class-page.mdx#page-expose-function-option-callback) returns a Promise, it will be awaited.

See [BrowserContext.ExposeFunctionAsync()](/api/class-browsercontext.mdx#browser-context-expose-function) for context-wide exposed function.

:::note

Functions installed via [Page.ExposeFunctionAsync()](/api/class-page.mdx#page-expose-function) survive navigations.
:::

**Usage**

An example of adding a `sha256` function to the page:

```csharp
using Microsoft.Playwright;
using System;
using System.Security.Cryptography;
using System.Threading.Tasks;

class PageExamples
{
    public static async Task Main()
    {
        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Webkit.LaunchAsync(new()
        {
            Headless = false
        });
        var page = await browser.NewPageAsync();

        await page.ExposeFunctionAsync("sha256", (string input) =>
        {
            return Convert.ToBase64String(
                SHA256.Create().ComputeHash(System.Text.Encoding.UTF8.GetBytes(input)));
        });

        await page.SetContentAsync("<script>\n" +
        "  async function onClick() {\n" +
        "    document.querySelector('div').textContent = await window.sha256('PLAYWRIGHT');\n" +
        "  }\n" +
        "</script>\n" +
        "<button onclick=\"onClick()\">Click me</button>\n" +
        "<div></div>");

        await page.ClickAsync("button");
        Console.WriteLine(await page.TextContentAsync("div"));
    }
}
```

**Arguments**
- `name` string
  
  Name of the function on the window object
- `callback` Action<T, TResult>
  
  Callback function which will be called in Playwright's context.

**Returns**
- Disposable

---

### Frame {/* #page-frame */}



Returns frame matching the specified criteria. Either `name` or `url` must be specified.

**Usage**

```csharp
var frame = page.Frame("frame-name");
```

```csharp
var frame = page.FrameByUrl(".*domain.*");
```

**Arguments**
- `name` string 
  
  Frame name specified in the `iframe`'s `name` attribute.

**Returns**
- Frame?

---

### FrameByUrl {/* #page-frame-by-url */}



Returns frame with matching URL.

**Usage**

```csharp
Page.FrameByUrl(url);
```

**Arguments**
- `url` string | Regex | Func<string, bool>
  
  A glob pattern, regex pattern or predicate receiving frame's `url` as a URL object.

**Returns**
- Frame?

---

### FrameLocator {/* #page-frame-locator */}



When working with iframes, you can create a frame locator that will enter the iframe and allow selecting elements in that iframe.

**Usage**

Following snippet locates element with text "Submit" in the iframe with id `my-frame`, like `<iframe id="my-frame">`:

```csharp
var locator = page.FrameLocator("#my-iframe").GetByText("Submit");
await locator.ClickAsync();
```

**Arguments**
- `selector` string
  
  A selector to use when resolving DOM element.

**Returns**
- FrameLocator

---

### Frames {/* #page-frames */}



An array of all frames attached to the page.

**Usage**

```csharp
Page.Frames
```

**Returns**
- IReadOnlyList<Frame>

---

### GetByAltText {/* #page-get-by-alt-text */}



Allows locating elements by their alt text.

**Usage**

For example, this method will find the image by alt text "Playwright logo":

```html
<img alt='Playwright logo'>
```

```csharp
await page.GetByAltText("Playwright logo").ClickAsync();
```

**Arguments**
- `text` string | Regex
  
  Text to locate the element for.
- `options` `PageGetByAltTextOptions?` *(optional)*
  - `Exact` bool? *(optional)*
    
    Whether to find an exact match: case-sensitive and whole-string. Default to false. Ignored when locating by a regular expression. Note that exact match still trims whitespace.

**Returns**
- Locator

---

### GetByLabel {/* #page-get-by-label */}



Allows locating input elements by the text of the associated `<label>` or `aria-labelledby` element, or by the `aria-label` attribute.

**Usage**

For example, this method will find inputs by label "Username" and "Password" in the following DOM:

```html
<input aria-label="Username">
<label for="password-input">Password:</label>
<input id="password-input">
```

```csharp
await page.GetByLabel("Username").FillAsync("john");
await page.GetByLabel("Password").FillAsync("secret");
```

**Arguments**
- `text` string | Regex
  
  Text to locate the element for.
- `options` `PageGetByLabelOptions?` *(optional)*
  - `Exact` bool? *(optional)*
    
    Whether to find an exact match: case-sensitive and whole-string. Default to false. Ignored when locating by a regular expression. Note that exact match still trims whitespace.

**Returns**
- Locator

---

### GetByPlaceholder {/* #page-get-by-placeholder */}



Allows locating input elements by the placeholder text.

**Usage**

For example, consider the following DOM structure.

```html
<input type="email" placeholder="name@example.com" />
```

You can fill the input after locating it by the placeholder text:

```csharp
await page
    .GetByPlaceholder("name@example.com")
    .FillAsync("playwright@microsoft.com");
```

**Arguments**
- `text` string | Regex
  
  Text to locate the element for.
- `options` `PageGetByPlaceholderOptions?` *(optional)*
  - `Exact` bool? *(optional)*
    
    Whether to find an exact match: case-sensitive and whole-string. Default to false. Ignored when locating by a regular expression. Note that exact match still trims whitespace.

**Returns**
- Locator

---

### GetByRole {/* #page-get-by-role */}



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

```csharp
await Expect(Page
    .GetByRole(AriaRole.Heading, new() { Name = "Sign up" }))
    .ToBeVisibleAsync();

await page
    .GetByRole(AriaRole.Checkbox, new() { Name = "Subscribe" })
    .CheckAsync();

await page
    .GetByRole(AriaRole.Button, new() {
        NameRegex = new Regex("submit", RegexOptions.IgnoreCase)
    })
    .ClickAsync();
```

**Arguments**
- `role` `enum AriaRole { Alert, Alertdialog, Application, Article, Banner, Blockquote, Button, Caption, Cell, Checkbox, Code, Columnheader, Combobox, Complementary, Contentinfo, Definition, Deletion, Dialog, Directory, Document, Emphasis, Feed, Figure, Form, Generic, Grid, Gridcell, Group, Heading, Img, Insertion, Link, List, Listbox, Listitem, Log, Main, Marquee, Math, Meter, Menu, Menubar, Menuitem, Menuitemcheckbox, Menuitemradio, Navigation, None, Note, Option, Paragraph, Presentation, Progressbar, Radio, Radiogroup, Region, Row, Rowgroup, Rowheader, Scrollbar, Search, Searchbox, Separator, Slider, Spinbutton, Status, Strong, Subscript, Superscript, Switch, Tab, Table, Tablist, Tabpanel, Term, Textbox, Time, Timer, Toolbar, Tooltip, Tree, Treegrid, Treeitem }`
  
  Required aria role.
- `options` `PageGetByRoleOptions?` *(optional)*
  - `Checked` bool? *(optional)*
    
    An attribute that is usually set by `aria-checked` or native `<input type=checkbox>` controls.
    
    Learn more about [`aria-checked`](https://www.w3.org/TR/wai-aria-1.2/#aria-checked).
  - `Description|DescriptionRegex` string? | Regex? *(optional)* 
    
    Option to match the [accessible description](https://w3c.github.io/accname/#dfn-accessible-description). By default, matching is case-insensitive and searches for a substring, use [Exact](/api/class-page.mdx#page-get-by-role-option-exact) to control this behavior.
    
    Learn more about [accessible description](https://w3c.github.io/accname/#dfn-accessible-description).
  - `Disabled` bool? *(optional)*
    
    An attribute that is usually set by `aria-disabled` or `disabled`.
    
    :::note
    
    Unlike most other attributes, `disabled` is inherited through the DOM hierarchy. Learn more about [`aria-disabled`](https://www.w3.org/TR/wai-aria-1.2/#aria-disabled).
    :::
    
  - `Exact` bool? *(optional)* 
    
    Whether [Name|NameRegex](/api/class-page.mdx#page-get-by-role-option-name) and [Description|DescriptionRegex](/api/class-page.mdx#page-get-by-role-option-description) are matched exactly: case-sensitive and whole-string. Defaults to false. Ignored when the value is a regular expression. Note that exact match still trims whitespace.
  - `Expanded` bool? *(optional)*
    
    An attribute that is usually set by `aria-expanded`.
    
    Learn more about [`aria-expanded`](https://www.w3.org/TR/wai-aria-1.2/#aria-expanded).
  - `IncludeHidden` bool? *(optional)*
    
    Option that controls whether hidden elements are matched. By default, only non-hidden elements, as [defined by ARIA](https://www.w3.org/TR/wai-aria-1.2/#tree_exclusion), are matched by role selector.
    
    Learn more about [`aria-hidden`](https://www.w3.org/TR/wai-aria-1.2/#aria-hidden).
  - `Level` int? *(optional)*
    
    A number attribute that is usually present for roles `heading`, `listitem`, `row`, `treeitem`, with default values for `<h1>-<h6>` elements.
    
    Learn more about [`aria-level`](https://www.w3.org/TR/wai-aria-1.2/#aria-level).
  - `Name|NameRegex` string? | Regex? *(optional)*
    
    Option to match the [accessible name](https://w3c.github.io/accname/#dfn-accessible-name). By default, matching is case-insensitive and searches for a substring, use [Exact](/api/class-page.mdx#page-get-by-role-option-exact) to control this behavior.
    
    Learn more about [accessible name](https://w3c.github.io/accname/#dfn-accessible-name).
  - `Pressed` bool? *(optional)*
    
    An attribute that is usually set by `aria-pressed`.
    
    Learn more about [`aria-pressed`](https://www.w3.org/TR/wai-aria-1.2/#aria-pressed).
  - `Selected` bool? *(optional)*
    
    An attribute that is usually set by `aria-selected`.
    
    Learn more about [`aria-selected`](https://www.w3.org/TR/wai-aria-1.2/#aria-selected).

**Returns**
- Locator

**Details**

Role selector **does not replace** accessibility audits and conformance tests, but rather gives early feedback about the ARIA guidelines.

Many html elements have an implicitly [defined role](https://w3c.github.io/html-aam/#html-element-role-mappings) that is recognized by the role selector. You can find all the [supported roles here](https://www.w3.org/TR/wai-aria-1.2/#role_definitions). ARIA guidelines **do not recommend** duplicating implicit roles and attributes by setting `role` and/or `aria-*` attributes to default values.

---

### GetByTestId {/* #page-get-by-test-id */}



Locate element by the test id.

**Usage**

Consider the following DOM structure.

```html
<button data-testid="directions">Itinéraire</button>
```

You can locate the element by its test id:

```csharp
await page.GetByTestId("directions").ClickAsync();
```

**Arguments**
- `testId` string | Regex
  
  Id to locate the element by.

**Returns**
- Locator

**Details**

By default, the `data-testid` attribute is used as a test id. Use [Selectors.SetTestIdAttribute()](/api/class-selectors.mdx#selectors-set-test-id-attribute) to configure a different test id attribute if necessary.

---

### GetByText {/* #page-get-by-text */}



Allows locating elements that contain given text.

See also [Locator.Filter()](/api/class-locator.mdx#locator-filter) that allows to match by another criteria, like an accessible role, and then filter by the text content.

**Usage**

Consider the following DOM structure:

```html
<div>Hello <span>world</span></div>
<div>Hello</div>
```

You can locate by text substring, exact string, or a regular expression:

```csharp
// Matches <span>
page.GetByText("world");

// Matches first <div>
page.GetByText("Hello world");

// Matches second <div>
page.GetByText("Hello", new() { Exact = true });

// Matches both <div>s
page.GetByText(new Regex("Hello"));

// Matches second <div>
page.GetByText(new Regex("^hello$", RegexOptions.IgnoreCase));
```

**Arguments**
- `text` string | Regex
  
  Text to locate the element for.
- `options` `PageGetByTextOptions?` *(optional)*
  - `Exact` bool? *(optional)*
    
    Whether to find an exact match: case-sensitive and whole-string. Default to false. Ignored when locating by a regular expression. Note that exact match still trims whitespace.

**Returns**
- Locator

**Details**

Matching by text always normalizes whitespace, even with exact match. For example, it turns multiple spaces into one, turns line breaks into spaces and ignores leading and trailing whitespace.

Input elements of the type `button` and `submit` are matched by their `value` instead of the text content. For example, locating by text `"Log in"` matches `<input type=button value="Log in">`.

---

### GetByTitle {/* #page-get-by-title */}



Allows locating elements by their title attribute.

**Usage**

Consider the following DOM structure.

```html
<span title='Issues count'>25 issues</span>
```

You can check the issues count after locating it by the title text:

```csharp
await Expect(Page.GetByTitle("Issues count")).toHaveText("25 issues");
```

**Arguments**
- `text` string | Regex
  
  Text to locate the element for.
- `options` `PageGetByTitleOptions?` *(optional)*
  - `Exact` bool? *(optional)*
    
    Whether to find an exact match: case-sensitive and whole-string. Default to false. Ignored when locating by a regular expression. Note that exact match still trims whitespace.

**Returns**
- Locator

---

### GoBackAsync {/* #page-go-back */}



Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. If cannot go back, returns `null`.

Navigate to the previous page in history.

:::warning

**Testing Back/Forward Cache (BFCache) is not supported.**  By default, Playwright disables the Back/Forward Cache across all browsers. Even if explicitly enabled, Playwright's internal state relies on network-level navigation events. Because BFCache restores unfreeze the DOM without firing these events, using `page.goBack()` or `page.goForward()` to trigger a BFCache restore will result in timeouts and a desynchronized `Page` state.
:::

**Usage**

```csharp
await Page.GoBackAsync(options);
```

**Arguments**
- `options` `PageGoBackOptions?` *(optional)*
  - `Timeout` float? *(optional)*
    
    Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [Page.SetDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `WaitUntil` `enum WaitUntilState { Load, DOMContentLoaded, NetworkIdle, Commit }?` *(optional)*
    
    When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
    * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- Response?

---

### GoForwardAsync {/* #page-go-forward */}



Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. If cannot go forward, returns `null`.

Navigate to the next page in history.

:::warning

**Testing Back/Forward Cache (BFCache) is not supported.**  By default, Playwright disables the Back/Forward Cache across all browsers. Even if explicitly enabled, Playwright's internal state relies on network-level navigation events. Because BFCache restores unfreeze the DOM without firing these events, using `page.goBack()` or `page.goForward()` to trigger a BFCache restore will result in timeouts and a desynchronized `Page` state.
:::

**Usage**

```csharp
await Page.GoForwardAsync(options);
```

**Arguments**
- `options` `PageGoForwardOptions?` *(optional)*
  - `Timeout` float? *(optional)*
    
    Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [Page.SetDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `WaitUntil` `enum WaitUntilState { Load, DOMContentLoaded, NetworkIdle, Commit }?` *(optional)*
    
    When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
    * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- Response?

---

### GotoAsync {/* #page-goto */}



Returns the main resource response. In case of multiple redirects, the navigation will resolve with the first non-redirect response.

The method will throw an error if:
* there's an SSL error (e.g. in case of self-signed certificates).
* target URL is invalid.
* the [Timeout](/api/class-page.mdx#page-goto-option-timeout) is exceeded during navigation.
* the remote server does not respond or is unreachable.
* the main resource failed to load.

The method will not throw an error when any valid HTTP status code is returned by the remote server, including 404 "Not Found" and 500 "Internal Server Error".  The status code for such responses can be retrieved by calling [Response.Status](/api/class-response.mdx#response-status).

:::note

The method either throws an error or returns a main resource response. The only exceptions are navigation to `about:blank` or navigation to the same URL with a different hash, which would succeed and return `null`.
:::

:::note
Headless mode doesn't support navigation to a PDF document. See the [upstream issue](https://bugs.chromium.org/p/chromium/issues/detail?id=761295).
:::

**Usage**

```csharp
await Page.GotoAsync(url, options);
```

**Arguments**
- `url` string
  
  URL to navigate page to. The url should include scheme, e.g. `https://`. When a [BaseURL](/api/class-browser.mdx#browser-new-context-option-base-url) via the context options was provided and the passed URL is a path, it gets merged via the [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor.
- `options` `PageGotoOptions?` *(optional)*
  - `Referer` string? *(optional)*
    
    Referer header value. If provided it will take preference over the referer header value set by [Page.SetExtraHTTPHeadersAsync()](/api/class-page.mdx#page-set-extra-http-headers).
  - `Timeout` float? *(optional)*
    
    Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [Page.SetDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `WaitUntil` `enum WaitUntilState { Load, DOMContentLoaded, NetworkIdle, Commit }?` *(optional)*
    
    When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
    * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- Response?

---

### HideHighlightAsync {/* #page-hide-highlight */}



Hide all locator highlight overlays previously added by [Locator.HighlightAsync()](/api/class-locator.mdx#locator-highlight) on this page.

**Usage**

```csharp
await Page.HideHighlightAsync();
```

**Returns**
- void

---

### IsClosed {/* #page-is-closed */}



Indicates that the page has been closed.

**Usage**

```csharp
Page.IsClosed
```

**Returns**
- bool

---

### Locator {/* #page-locator */}



The method returns an element locator that can be used to perform actions on this page / frame. Locator is resolved to the element immediately before performing an action, so a series of actions on the same locator can in fact be performed on different DOM elements. That would happen if the DOM structure between those actions has changed.

[Learn more about locators](../locators.mdx).

**Usage**

```csharp
Page.Locator(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to use when resolving DOM element.
- `options` `PageLocatorOptions?` *(optional)*
  - `Has` Locator? *(optional)*
    
    Narrows down the results of the method to those which contain elements matching this relative locator. For example, `article` that has `text=Playwright` matches `<article><div>Playwright</div></article>`.
    
    Inner locator **must be relative** to the outer locator and is queried starting with the outer locator match, not the document root. For example, you can find `content` that has `div` in `<article><content><div>Playwright</div></content></article>`. However, looking for `content` that has `article div` will fail, because the inner locator must be relative and should not use any elements outside the `content`.
    
    Note that outer and inner locators must belong to the same frame. Inner locator must not contain FrameLocators.
  - `HasNot` Locator? *(optional)* 
    
    Matches elements that do not contain an element that matches an inner locator. Inner locator is queried against the outer one. For example, `article` that does not have `div` matches `<article><span>Playwright</span></article>`.
    
    Note that outer and inner locators must belong to the same frame. Inner locator must not contain FrameLocators.
  - `HasNotText|HasNotTextRegex` string? | Regex? *(optional)* 
    
    Matches elements that do not contain specified text somewhere inside, possibly in a child or a descendant element. When passed a string, matching is case-insensitive and searches for a substring.
  - `HasText|HasTextRegex` string? | Regex? *(optional)*
    
    Matches elements containing specified text somewhere inside, possibly in a child or a descendant element. When passed a string, matching is case-insensitive and searches for a substring. For example, `"Playwright"` matches `<article><div>Playwright</div></article>`.

**Returns**
- Locator

---

### MainFrame {/* #page-main-frame */}



The page's main frame. Page is guaranteed to have a main frame which persists during navigations.

**Usage**

```csharp
Page.MainFrame
```

**Returns**
- Frame

---

### OpenerAsync {/* #page-opener */}



Returns the opener for popup pages and `null` for others. If the opener has been closed already the returns `null`.

**Usage**

```csharp
await Page.OpenerAsync();
```

**Returns**
- Page?

---

### PageErrorsAsync {/* #page-page-errors */}



Returns up to (currently) 200 last page errors from this page. See [Page.PageError](/api/class-page.mdx#page-event-page-error) for more details.

**Usage**

```csharp
await Page.PageErrorsAsync();
```

**Returns**
- IReadOnlyList<string>

---

### PauseAsync {/* #page-pause */}



Pauses script execution. Playwright will stop executing the script and wait for the user to either press the 'Resume' button in the page overlay or to call `playwright.resume()` in the DevTools console.

User can inspect selectors or perform manual steps while paused. Resume will continue running the original script from the place it was paused.

:::note

This method requires Playwright to be started in a headed mode, with a falsy [Headless](/api/class-browsertype.mdx#browser-type-launch-option-headless) option.
:::

**Usage**

```csharp
await Page.PauseAsync();
```

**Returns**
- void

---

### PdfAsync {/* #page-pdf */}



Returns the PDF buffer.

`page.pdf()` generates a pdf of the page with `print` css media. To generate a pdf with `screen` media, call [Page.EmulateMediaAsync()](/api/class-page.mdx#page-emulate-media) before calling `page.pdf()`:

:::note

By default, `page.pdf()` generates a pdf with modified colors for printing. Use the [`-webkit-print-color-adjust`](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-print-color-adjust) property to force rendering of exact colors.
:::

**Usage**

```csharp
// Generates a PDF with 'screen' media type
await page.EmulateMediaAsync(new() { Media = Media.Screen });
await page.PdfAsync(new() { Path = "page.pdf" });
```

The [Width](/api/class-page.mdx#page-pdf-option-width), [Height](/api/class-page.mdx#page-pdf-option-height), and [Margin](/api/class-page.mdx#page-pdf-option-margin) options accept values labeled with units. Unlabeled values are treated as pixels.

A few examples:
* `page.pdf({width: 100})` - prints with width set to 100 pixels
* `page.pdf({width: '100px'})` - prints with width set to 100 pixels
* `page.pdf({width: '10cm'})` - prints with width set to 10 centimeters.

All possible units are:
* `px` - pixel
* `in` - inch
* `cm` - centimeter
* `mm` - millimeter

The [Format](/api/class-page.mdx#page-pdf-option-format) options are:
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

[HeaderTemplate](/api/class-page.mdx#page-pdf-option-header-template) and [FooterTemplate](/api/class-page.mdx#page-pdf-option-footer-template) markup have the following limitations: > 1. Script tags inside templates are not evaluated. > 2. Page styles are not visible inside templates.
:::

**Arguments**
- `options` `PagePdfOptions?` *(optional)*
  - `DisplayHeaderFooter` bool? *(optional)*
    
    Display header and footer. Defaults to `false`.
  - `FooterTemplate` string? *(optional)*
    
    HTML template for the print footer. Should use the same format as the [HeaderTemplate](/api/class-page.mdx#page-pdf-option-header-template).
  - `Format` string? *(optional)*
    
    Paper format. If set, takes priority over [Width](/api/class-page.mdx#page-pdf-option-width) or [Height](/api/class-page.mdx#page-pdf-option-height) options. Defaults to 'Letter'.
  - `HeaderTemplate` string? *(optional)*
    
    HTML template for the print header. Should be valid HTML markup with following classes used to inject printing values into them:
    * `'date'` formatted print date
    * `'title'` document title
    * `'url'` document location
    * `'pageNumber'` current page number
    * `'totalPages'` total pages in the document
  - `Height` string? *(optional)*
    
    Paper height, accepts values labeled with units.
  - `Landscape` bool? *(optional)*
    
    Paper orientation. Defaults to `false`.
  - `Margin` Margin? *(optional)*
    - `Top` string? *(optional)*
      
      Top margin, accepts values labeled with units. Defaults to `0`.
    - `Right` string? *(optional)*
      
      Right margin, accepts values labeled with units. Defaults to `0`.
    - `Bottom` string? *(optional)*
      
      Bottom margin, accepts values labeled with units. Defaults to `0`.
    - `Left` string? *(optional)*
      
      Left margin, accepts values labeled with units. Defaults to `0`.
    
    Paper margins, defaults to none.
  - `Outline` bool? *(optional)* 
    
    Whether or not to embed the document outline into the PDF. Defaults to `false`.
  - `PageRanges` string? *(optional)*
    
    Paper ranges to print, e.g., '1-5, 8, 11-13'. Defaults to the empty string, which means print all pages.
  - `Path` string? *(optional)*
    
    The file path to save the PDF to. If [Path](/api/class-page.mdx#page-pdf-option-path) is a relative path, then it is resolved relative to the current working directory. If no path is provided, the PDF won't be saved to the disk.
  - `PreferCSSPageSize` bool? *(optional)*
    
    Give any CSS `@page` size declared in the page priority over what is declared in [Width](/api/class-page.mdx#page-pdf-option-width) and [Height](/api/class-page.mdx#page-pdf-option-height) or [Format](/api/class-page.mdx#page-pdf-option-format) options. Defaults to `false`, which will scale the content to fit the paper size.
  - `PrintBackground` bool? *(optional)*
    
    Print background graphics. Defaults to `false`.
  - `Scale` float? *(optional)*
    
    Scale of the webpage rendering. Defaults to `1`. Scale amount must be between 0.1 and 2.
  - `Tagged` bool? *(optional)* 
    
    Whether or not to generate tagged (accessible) PDF. Defaults to `false`.
  - `Width` string? *(optional)*
    
    Paper width, accepts values labeled with units.

**Returns**
- byte&#91;&#93;

---

### PickLocatorAsync {/* #page-pick-locator */}



Enters pick locator mode where hovering over page elements highlights them and shows the corresponding locator. Once the user clicks an element, the mode is deactivated and the Locator for the picked element is returned.

**Usage**

```csharp
var locator = await page.PickLocatorAsync();
Console.WriteLine(locator);
```

**Returns**
- Locator

---

### ReloadAsync {/* #page-reload */}



This method reloads the current page, in the same way as if the user had triggered a browser refresh. Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect.

**Usage**

```csharp
await Page.ReloadAsync(options);
```

**Arguments**
- `options` `PageReloadOptions?` *(optional)*
  - `Timeout` float? *(optional)*
    
    Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [Page.SetDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `WaitUntil` `enum WaitUntilState { Load, DOMContentLoaded, NetworkIdle, Commit }?` *(optional)*
    
    When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
    * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- Response?

---

### RemoveLocatorHandlerAsync {/* #page-remove-locator-handler */}



Removes all locator handlers added by [Page.AddLocatorHandlerAsync()](/api/class-page.mdx#page-add-locator-handler) for a specific locator.

**Usage**

```csharp
await Page.RemoveLocatorHandlerAsync(locator);
```

**Arguments**
- `locator` Locator
  
  Locator passed to [Page.AddLocatorHandlerAsync()](/api/class-page.mdx#page-add-locator-handler).

**Returns**
- void

---

### RequestGCAsync {/* #page-request-gc */}



Request the page to perform garbage collection. Note that there is no guarantee that all unreachable objects will be collected.

This is useful to help detect memory leaks. For example, if your page has a large object `'suspect'` that might be leaked, you can check that it does not leak by using a [`WeakRef`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef).

```csharp
// 1. In your page, save a WeakRef for the "suspect".
await Page.EvaluateAsync("globalThis.suspectWeakRef = new WeakRef(suspect)");
// 2. Request garbage collection.
await Page.RequestGCAsync();
// 3. Check that weak ref does not deref to the original object.
Assert.True(await Page.EvaluateAsync("!globalThis.suspectWeakRef.deref()"));
```

**Usage**

```csharp
await Page.RequestGCAsync();
```

**Returns**
- void

---

### RequestsAsync {/* #page-requests */}



Returns up to (currently) 100 last network request from this page. See [Page.Request](/api/class-page.mdx#page-event-request) for more details.

Returned requests should be accessed immediately, otherwise they might be collected to prevent unbounded memory growth as new requests come in. Once collected, retrieving most information about the request is impossible.

Note that requests reported through the [Page.Request](/api/class-page.mdx#page-event-request) request are not collected, so there is a trade off between efficient memory usage with [Page.RequestsAsync()](/api/class-page.mdx#page-requests) and the amount of available information reported through [Page.Request](/api/class-page.mdx#page-event-request).

**Usage**

```csharp
await Page.RequestsAsync();
```

**Returns**
- IReadOnlyList<Request>

---

### RouteAsync {/* #page-route */}



Routing provides the capability to modify network requests that are made by a page.

Once routing is enabled, every request matching the url pattern will stall unless it's continued, fulfilled or aborted.

:::note

The handler will only be called for the first url if the response is a redirect.
:::

:::note
[Page.RouteAsync()](/api/class-page.mdx#page-route) will not intercept requests intercepted by Service Worker. See [this](https://github.com/microsoft/playwright/issues/1090) issue. We recommend disabling Service Workers when using request interception by setting [ServiceWorkers](/api/class-browser.mdx#browser-new-context-option-service-workers) to `'block'`.
:::

:::note
[Page.RouteAsync()](/api/class-page.mdx#page-route) will not intercept the first request of a popup page. Use [BrowserContext.RouteAsync()](/api/class-browsercontext.mdx#browser-context-route) instead.
:::

**Usage**

An example of a naive handler that aborts all image requests:

```csharp
var page = await browser.NewPageAsync();
await page.RouteAsync("**/*.{png,jpg,jpeg}", async r => await r.AbortAsync());
await page.GotoAsync("https://www.microsoft.com");
```

or the same snippet using a regex pattern instead:

```csharp
var page = await browser.NewPageAsync();
await page.RouteAsync(new Regex("(\\.png$)|(\\.jpg$)"), async r => await r.AbortAsync());
await page.GotoAsync("https://www.microsoft.com");
```

It is possible to examine the request to decide the route action. For example, mocking all requests that contain some post data, and leaving all other requests as is:

```csharp
await page.RouteAsync("/api/**", async r =>
{
  if (r.Request.PostData.Contains("my-string"))
      await r.FulfillAsync(new() { Body = "mocked-data" });
  else
      await r.ContinueAsync();
});
```

If a request matches multiple registered routes, the most recently registered route takes precedence.

Page routes take precedence over browser context routes (set up with [BrowserContext.RouteAsync()](/api/class-browsercontext.mdx#browser-context-route)) when request matches both handlers.

To remove a route with its handler you can use [Page.UnrouteAsync()](/api/class-page.mdx#page-unroute).

:::note

Enabling routing disables http cache.
:::

**Arguments**
- `url` string | Regex | Func<string, bool>
  
  A glob pattern, regex pattern, or predicate that receives a URL to match during routing. If [BaseURL](/api/class-browser.mdx#browser-new-context-option-base-url) is set in the context options and the provided URL is a string that does not start with `*`, it is resolved using the [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor.
- `handler` Action<Route>
  
  handler function to route the request.
- `options` `PageRouteOptions?` *(optional)*
  - `Times` int? *(optional)* 
    
    How often a route should be used. By default it will be used every time.

**Returns**
- Disposable

---

### RouteFromHARAsync {/* #page-route-from-har */}



If specified the network requests that are made in the page will be served from the HAR file. Read more about [Replaying from HAR](../mock.mdx#replaying-from-har).

Playwright will not serve requests intercepted by Service Worker from the HAR file. See [this](https://github.com/microsoft/playwright/issues/1090) issue. We recommend disabling Service Workers when using request interception by setting [ServiceWorkers](/api/class-browser.mdx#browser-new-context-option-service-workers) to `'block'`.

**Usage**

```csharp
await Page.RouteFromHARAsync(har, options);
```

**Arguments**
- `har` string
  
  Path to a [HAR](http://www.softwareishard.com/blog/har-12-spec) file with prerecorded network data. If `path` is a relative path, then it is resolved relative to the current working directory.
- `options` `PageRouteFromHAROptions?` *(optional)*
  - `NotFound` `enum HarNotFound { Abort, Fallback }?` *(optional)*
    * If set to 'abort' any request not found in the HAR file will be aborted.
    * If set to 'fallback' missing requests will be sent to the network.
    
    Defaults to abort.
  - `Update` bool? *(optional)*
    
    If specified, updates the given HAR with the actual network information instead of serving from file. The file is written to disk when [BrowserContext.CloseAsync()](/api/class-browsercontext.mdx#browser-context-close) is called.
  - `UpdateContent` `enum RouteFromHarUpdateContentPolicy { Embed, Attach }?` *(optional)* 
    
    Optional setting to control resource content management. If `attach` is specified, resources are persisted as separate files or entries in the ZIP archive. If `embed` is specified, content is stored inline the HAR file.
  - `UpdateMode` `enum HarMode { Full, Minimal }?` *(optional)* 
    
    When set to `minimal`, only record information necessary for routing from HAR. This omits sizes, timing, page, cookies, security and other types of HAR information that are not used when replaying from HAR. Defaults to `minimal`.
  - `Url|UrlRegex` string? | Regex? *(optional)*
    
    A glob pattern, regular expression or predicate to match the request URL. Only requests with URL matching the pattern will be served from the HAR file. If not specified, all requests are served from the HAR file.

**Returns**
- void

---

### RouteWebSocketAsync {/* #page-route-web-socket */}



This method allows to modify websocket connections that are made by the page.

Note that only `WebSocket`s created after this method was called will be routed. It is recommended to call this method before navigating the page.

**Usage**

Below is an example of a simple mock that responds to a single message. See WebSocketRoute for more details and examples.

```csharp
await page.RouteWebSocketAsync("/ws", ws => {
  ws.OnMessage(frame => {
    if (frame.Text == "request")
      ws.Send("response");
  });
});
```

**Arguments**
- `url` string | Regex | Func<string, bool>
  
  Only WebSockets with the url matching this pattern will be routed. A string pattern can be relative to the [BaseURL](/api/class-browser.mdx#browser-new-context-option-base-url) context option.
- `handler` Action<WebSocketRoute>
  
  Handler function to route the WebSocket.

**Returns**
- void

---

### RunAndWaitForConsoleMessageAsync {/* #page-wait-for-console-message */}



Performs action and waits for a ConsoleMessage to be logged by in the page. If predicate is provided, it passes ConsoleMessage value into the `predicate` function and waits for `predicate(message)` to return a truthy value. Will throw an error if the page is closed before the [Page.Console](/api/class-page.mdx#page-event-console) event is fired.

**Usage**

```csharp
await Page.RunAndWaitForConsoleMessageAsync(action, options);
```

**Arguments**
- `action` Func<Task> 
  
  Action that triggers the event.
- `options` `PageRunAndWaitForConsoleMessageOptions?` *(optional)*
  - `Predicate` Func<ConsoleMessage?, bool> *(optional)*
    
    Receives the ConsoleMessage object and resolves to truthy value when the waiting should resolve.
  - `Timeout` float? *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- ConsoleMessage

---

### WaitForConsoleMessageAsync {/* #page-wait-for-console-message */}



Performs action and waits for a ConsoleMessage to be logged by in the page. If predicate is provided, it passes ConsoleMessage value into the `predicate` function and waits for `predicate(message)` to return a truthy value. Will throw an error if the page is closed before the [Page.Console](/api/class-page.mdx#page-event-console) event is fired.

**Usage**

```csharp
await Page.WaitForConsoleMessageAsync(action, options);
```

**Arguments**
- `options` `PageRunAndWaitForConsoleMessageOptions?` *(optional)*
  - `Predicate` Func<ConsoleMessage?, bool> *(optional)*
    
    Receives the ConsoleMessage object and resolves to truthy value when the waiting should resolve.
  - `Timeout` float? *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- ConsoleMessage

---

### RunAndWaitForDownloadAsync {/* #page-wait-for-download */}



Performs action and waits for a new Download. If predicate is provided, it passes Download value into the `predicate` function and waits for `predicate(download)` to return a truthy value. Will throw an error if the page is closed before the download event is fired.

**Usage**

```csharp
await Page.RunAndWaitForDownloadAsync(action, options);
```

**Arguments**
- `action` Func<Task> 
  
  Action that triggers the event.
- `options` `PageRunAndWaitForDownloadOptions?` *(optional)*
  - `Predicate` Func<Download?, bool> *(optional)*
    
    Receives the Download object and resolves to truthy value when the waiting should resolve.
  - `Timeout` float? *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- Download

---

### WaitForDownloadAsync {/* #page-wait-for-download */}



Performs action and waits for a new Download. If predicate is provided, it passes Download value into the `predicate` function and waits for `predicate(download)` to return a truthy value. Will throw an error if the page is closed before the download event is fired.

**Usage**

```csharp
await Page.WaitForDownloadAsync(action, options);
```

**Arguments**
- `options` `PageRunAndWaitForDownloadOptions?` *(optional)*
  - `Predicate` Func<Download?, bool> *(optional)*
    
    Receives the Download object and resolves to truthy value when the waiting should resolve.
  - `Timeout` float? *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- Download

---

### RunAndWaitForFileChooserAsync {/* #page-wait-for-file-chooser */}



Performs action and waits for a new FileChooser to be created. If predicate is provided, it passes FileChooser value into the `predicate` function and waits for `predicate(fileChooser)` to return a truthy value. Will throw an error if the page is closed before the file chooser is opened.

**Usage**

```csharp
await Page.RunAndWaitForFileChooserAsync(action, options);
```

**Arguments**
- `action` Func<Task> 
  
  Action that triggers the event.
- `options` `PageRunAndWaitForFileChooserOptions?` *(optional)*
  - `Predicate` Func<FileChooser?, bool> *(optional)*
    
    Receives the FileChooser object and resolves to truthy value when the waiting should resolve.
  - `Timeout` float? *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- FileChooser

---

### WaitForFileChooserAsync {/* #page-wait-for-file-chooser */}



Performs action and waits for a new FileChooser to be created. If predicate is provided, it passes FileChooser value into the `predicate` function and waits for `predicate(fileChooser)` to return a truthy value. Will throw an error if the page is closed before the file chooser is opened.

**Usage**

```csharp
await Page.WaitForFileChooserAsync(action, options);
```

**Arguments**
- `options` `PageRunAndWaitForFileChooserOptions?` *(optional)*
  - `Predicate` Func<FileChooser?, bool> *(optional)*
    
    Receives the FileChooser object and resolves to truthy value when the waiting should resolve.
  - `Timeout` float? *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- FileChooser

---

### RunAndWaitForPopupAsync {/* #page-wait-for-popup */}



Performs action and waits for a popup Page. If predicate is provided, it passes Popup value into the `predicate` function and waits for `predicate(page)` to return a truthy value. Will throw an error if the page is closed before the popup event is fired.

**Usage**

```csharp
await Page.RunAndWaitForPopupAsync(action, options);
```

**Arguments**
- `action` Func<Task> 
  
  Action that triggers the event.
- `options` `PageRunAndWaitForPopupOptions?` *(optional)*
  - `Predicate` Func<Page?, bool> *(optional)*
    
    Receives the Page object and resolves to truthy value when the waiting should resolve.
  - `Timeout` float? *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- Page

---

### WaitForPopupAsync {/* #page-wait-for-popup */}



Performs action and waits for a popup Page. If predicate is provided, it passes Popup value into the `predicate` function and waits for `predicate(page)` to return a truthy value. Will throw an error if the page is closed before the popup event is fired.

**Usage**

```csharp
await Page.WaitForPopupAsync(action, options);
```

**Arguments**
- `options` `PageRunAndWaitForPopupOptions?` *(optional)*
  - `Predicate` Func<Page?, bool> *(optional)*
    
    Receives the Page object and resolves to truthy value when the waiting should resolve.
  - `Timeout` float? *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- Page

---

### RunAndWaitForRequestAsync {/* #page-wait-for-request */}



Waits for the matching request and returns it. See [waiting for event](../events.mdx#waiting-for-event) for more details about events.

**Usage**

```csharp
// Waits for the next request with the specified url.
await page.RunAndWaitForRequestAsync(async () =>
{
    await page.GetByText("trigger request").ClickAsync();
}, "http://example.com/resource");

// Alternative way with a predicate.
await page.RunAndWaitForRequestAsync(async () =>
{
    await page.GetByText("trigger request").ClickAsync();
}, request => request.Url == "https://example.com" && request.Method == "GET");
```

**Arguments**
- `action` Func<Task> 
  
  Action that triggers the event.
- `urlOrPredicate` string | Regex | Func<Request, bool>
  
  Request URL string, regex or predicate receiving Request object. When a [BaseURL](/api/class-browser.mdx#browser-new-context-option-base-url) via the context options was provided and the passed URL is a path, it gets merged via the [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor.
- `options` `PageRunAndWaitForRequestOptions?` *(optional)*
  - `Timeout` float? *(optional)*
    
    Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be changed by using the [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) method.

**Returns**
- Request

---

### WaitForRequestAsync {/* #page-wait-for-request */}



Waits for the matching request and returns it. See [waiting for event](../events.mdx#waiting-for-event) for more details about events.

**Usage**

```csharp
// Waits for the next request with the specified url.
await page.RunAndWaitForRequestAsync(async () =>
{
    await page.GetByText("trigger request").ClickAsync();
}, "http://example.com/resource");

// Alternative way with a predicate.
await page.RunAndWaitForRequestAsync(async () =>
{
    await page.GetByText("trigger request").ClickAsync();
}, request => request.Url == "https://example.com" && request.Method == "GET");
```

**Arguments**
- `urlOrPredicate` string | Regex | Func<Request, bool>
  
  Request URL string, regex or predicate receiving Request object. When a [BaseURL](/api/class-browser.mdx#browser-new-context-option-base-url) via the context options was provided and the passed URL is a path, it gets merged via the [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor.
- `options` `PageRunAndWaitForRequestOptions?` *(optional)*
  - `Timeout` float? *(optional)*
    
    Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be changed by using the [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) method.

**Returns**
- Request

---

### RunAndWaitForRequestFinishedAsync {/* #page-wait-for-request-finished */}



Performs action and waits for a Request to finish loading. If predicate is provided, it passes Request value into the `predicate` function and waits for `predicate(request)` to return a truthy value. Will throw an error if the page is closed before the [Page.RequestFinished](/api/class-page.mdx#page-event-request-finished) event is fired.

**Usage**

```csharp
await Page.RunAndWaitForRequestFinishedAsync(action, options);
```

**Arguments**
- `action` Func<Task>
  
  Action that triggers the event.
- `options` `PageRunAndWaitForRequestFinishedOptions?` *(optional)*
  - `Predicate` Func<Request?, bool> *(optional)*
    
    Receives the Request object and resolves to truthy value when the waiting should resolve.
  - `Timeout` float? *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- Request

---

### WaitForRequestFinishedAsync {/* #page-wait-for-request-finished */}



Performs action and waits for a Request to finish loading. If predicate is provided, it passes Request value into the `predicate` function and waits for `predicate(request)` to return a truthy value. Will throw an error if the page is closed before the [Page.RequestFinished](/api/class-page.mdx#page-event-request-finished) event is fired.

**Usage**

```csharp
await Page.WaitForRequestFinishedAsync(action, options);
```

**Arguments**
- `options` `PageRunAndWaitForRequestFinishedOptions?` *(optional)*
  - `Predicate` Func<Request?, bool> *(optional)*
    
    Receives the Request object and resolves to truthy value when the waiting should resolve.
  - `Timeout` float? *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- Request

---

### RunAndWaitForResponseAsync {/* #page-wait-for-response */}



Returns the matched response. See [waiting for event](../events.mdx#waiting-for-event) for more details about events.

**Usage**

```csharp
// Waits for the next response with the specified url.
await page.RunAndWaitForResponseAsync(async () =>
{
    await page.GetByText("trigger response").ClickAsync();
}, "http://example.com/resource");

// Alternative way with a predicate.
await page.RunAndWaitForResponseAsync(async () =>
{
    await page.GetByText("trigger response").ClickAsync();
}, response => response.Url == "https://example.com" && response.Status == 200 && response.Request.Method == "GET");
```

**Arguments**
- `action` Func<Task> 
  
  Action that triggers the event.
- `urlOrPredicate` string | Regex | Func<Response, bool>
  
  Request URL string, regex or predicate receiving Response object. When a [BaseURL](/api/class-browser.mdx#browser-new-context-option-base-url) via the context options was provided and the passed URL is a path, it gets merged via the [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor.
- `options` `PageRunAndWaitForResponseOptions?` *(optional)*
  - `Timeout` float? *(optional)*
    
    Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Response

---

### WaitForResponseAsync {/* #page-wait-for-response */}



Returns the matched response. See [waiting for event](../events.mdx#waiting-for-event) for more details about events.

**Usage**

```csharp
// Waits for the next response with the specified url.
await page.RunAndWaitForResponseAsync(async () =>
{
    await page.GetByText("trigger response").ClickAsync();
}, "http://example.com/resource");

// Alternative way with a predicate.
await page.RunAndWaitForResponseAsync(async () =>
{
    await page.GetByText("trigger response").ClickAsync();
}, response => response.Url == "https://example.com" && response.Status == 200 && response.Request.Method == "GET");
```

**Arguments**
- `urlOrPredicate` string | Regex | Func<Response, bool>
  
  Request URL string, regex or predicate receiving Response object. When a [BaseURL](/api/class-browser.mdx#browser-new-context-option-base-url) via the context options was provided and the passed URL is a path, it gets merged via the [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor.
- `options` `PageRunAndWaitForResponseOptions?` *(optional)*
  - `Timeout` float? *(optional)*
    
    Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- Response

---

### RunAndWaitForWebSocketAsync {/* #page-wait-for-web-socket */}



Performs action and waits for a new WebSocket. If predicate is provided, it passes WebSocket value into the `predicate` function and waits for `predicate(webSocket)` to return a truthy value. Will throw an error if the page is closed before the WebSocket event is fired.

**Usage**

```csharp
await Page.RunAndWaitForWebSocketAsync(action, options);
```

**Arguments**
- `action` Func<Task> 
  
  Action that triggers the event.
- `options` `PageRunAndWaitForWebSocketOptions?` *(optional)*
  - `Predicate` Func<WebSocket?, bool> *(optional)*
    
    Receives the WebSocket object and resolves to truthy value when the waiting should resolve.
  - `Timeout` float? *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- WebSocket

---

### WaitForWebSocketAsync {/* #page-wait-for-web-socket */}



Performs action and waits for a new WebSocket. If predicate is provided, it passes WebSocket value into the `predicate` function and waits for `predicate(webSocket)` to return a truthy value. Will throw an error if the page is closed before the WebSocket event is fired.

**Usage**

```csharp
await Page.WaitForWebSocketAsync(action, options);
```

**Arguments**
- `options` `PageRunAndWaitForWebSocketOptions?` *(optional)*
  - `Predicate` Func<WebSocket?, bool> *(optional)*
    
    Receives the WebSocket object and resolves to truthy value when the waiting should resolve.
  - `Timeout` float? *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- WebSocket

---

### RunAndWaitForWorkerAsync {/* #page-wait-for-worker */}



Performs action and waits for a new Worker. If predicate is provided, it passes Worker value into the `predicate` function and waits for `predicate(worker)` to return a truthy value. Will throw an error if the page is closed before the worker event is fired.

**Usage**

```csharp
await Page.RunAndWaitForWorkerAsync(action, options);
```

**Arguments**
- `action` Func<Task> 
  
  Action that triggers the event.
- `options` `PageRunAndWaitForWorkerOptions?` *(optional)*
  - `Predicate` Func<Worker?, bool> *(optional)*
    
    Receives the Worker object and resolves to truthy value when the waiting should resolve.
  - `Timeout` float? *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- Worker

---

### WaitForWorkerAsync {/* #page-wait-for-worker */}



Performs action and waits for a new Worker. If predicate is provided, it passes Worker value into the `predicate` function and waits for `predicate(worker)` to return a truthy value. Will throw an error if the page is closed before the worker event is fired.

**Usage**

```csharp
await Page.WaitForWorkerAsync(action, options);
```

**Arguments**
- `options` `PageRunAndWaitForWorkerOptions?` *(optional)*
  - `Predicate` Func<Worker?, bool> *(optional)*
    
    Receives the Worker object and resolves to truthy value when the waiting should resolve.
  - `Timeout` float? *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- Worker

---

### ScreenshotAsync {/* #page-screenshot */}



Returns the buffer with the captured screenshot.

**Usage**

```csharp
await Page.ScreenshotAsync(options);
```

**Arguments**
- `options` `PageScreenshotOptions?` *(optional)*
  - `Animations` `enum ScreenshotAnimations { Disabled, Allow }?` *(optional)*
    
    When set to `"disabled"`, stops CSS animations, CSS transitions and Web Animations. Animations get different treatment depending on their duration:
    * finite animations are fast-forwarded to completion, so they'll fire `transitionend` event.
    * infinite animations are canceled to initial state, and then played over after the screenshot.
    
    Defaults to `"allow"` that leaves animations untouched.
  - `Caret` `enum ScreenshotCaret { Hide, Initial }?` *(optional)*
    
    When set to `"hide"`, screenshot will hide text caret. When set to `"initial"`, text caret behavior will not be changed.  Defaults to `"hide"`.
  - `Clip` Clip? *(optional)*
    - `X` float
      
      x-coordinate of top-left corner of clip area
    - `Y` float
      
      y-coordinate of top-left corner of clip area
    - `Width` float
      
      width of clipping area
    - `Height` float
      
      height of clipping area
    
    An object which specifies clipping of the resulting image.
  - `FullPage` bool? *(optional)*
    
    When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Defaults to `false`.
  - `Mask` IEnumerable?<Locator> *(optional)*
    
    Specify locators that should be masked when the screenshot is taken. Masked elements will be overlaid with a pink box `#FF00FF` (customized by [MaskColor](/api/class-page.mdx#page-screenshot-option-mask-color)) that completely covers its bounding box. The mask is also applied to invisible elements, see [Matching only visible elements](../locators.mdx#matching-only-visible-elements) to disable that.
  - `MaskColor` string? *(optional)* 
    
    Specify the color of the overlay box for masked elements, in [CSS color format](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value). Default color is pink `#FF00FF`.
  - `OmitBackground` bool? *(optional)*
    
    Hides default white background and allows capturing screenshots with transparency. Not applicable to `jpeg` images. Defaults to `false`.
  - `Path` string? *(optional)*
    
    The file path to save the image to. The screenshot type will be inferred from file extension. If [Path](/api/class-page.mdx#page-screenshot-option-path) is a relative path, then it is resolved relative to the current working directory. If no path is provided, the image won't be saved to the disk.
  - `Quality` int? *(optional)*
    
    The quality of the image, between 0-100. Not applicable to `png` images. For `jpeg` the default is `80`. For `webp`, a quality of `100` (the default) produces a lossless image, while lower values use lossy compression.
  - `Scale` `enum ScreenshotScale { Css, Device }?` *(optional)*
    
    When set to `"css"`, screenshot will have a single pixel per each css pixel on the page. For high-dpi devices, this will keep screenshots small. Using `"device"` option will produce a single pixel per each device pixel, so screenshots of high-dpi devices will be twice as large or even larger.
    
    Defaults to `"device"`.
  - `Style` string? *(optional)* 
    
    Text of the stylesheet to apply while making the screenshot. This is where you can hide dynamic elements, make elements invisible or change their properties to help you creating repeatable screenshots. This stylesheet pierces the Shadow DOM and applies to the inner frames.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `Type` `enum ScreenshotType { Png, Jpeg, Webp }?` *(optional)*
    
    Specify screenshot type, defaults to `png`.

**Returns**
- byte&#91;&#93;

---

### SetContentAsync {/* #page-set-content */}



This method internally calls [document.write()](https://developer.mozilla.org/en-US/docs/Web/API/Document/write), inheriting all its specific characteristics and behaviors.

**Usage**

```csharp
await Page.SetContentAsync(html, options);
```

**Arguments**
- `html` string
  
  HTML markup to assign to the page.
- `options` `PageSetContentOptions?` *(optional)*
  - `Timeout` float? *(optional)*
    
    Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [Page.SetDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `WaitUntil` `enum WaitUntilState { Load, DOMContentLoaded, NetworkIdle, Commit }?` *(optional)*
    
    When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
    * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- void

---

### SetDefaultNavigationTimeout {/* #page-set-default-navigation-timeout */}



This setting will change the default maximum navigation time for the following methods and related shortcuts:
* [Page.GoBackAsync()](/api/class-page.mdx#page-go-back)
* [Page.GoForwardAsync()](/api/class-page.mdx#page-go-forward)
* [Page.GotoAsync()](/api/class-page.mdx#page-goto)
* [Page.ReloadAsync()](/api/class-page.mdx#page-reload)
* [Page.SetContentAsync()](/api/class-page.mdx#page-set-content)
* [Page.RunAndWaitForNavigationAsync()](/api/class-page.mdx#page-wait-for-navigation)
* [Page.WaitForURLAsync()](/api/class-page.mdx#page-wait-for-url)

:::note

[Page.SetDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) takes priority over [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout), [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) and [BrowserContext.SetDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout).
:::

**Usage**

```csharp
Page.SetDefaultNavigationTimeout(timeout);
```

**Arguments**
- `timeout` float
  
  Maximum navigation time in milliseconds

---

### SetDefaultTimeout {/* #page-set-default-timeout */}



This setting will change the default maximum time for all the methods accepting [timeout](/api/class-page.mdx#page-set-default-timeout-option-timeout) option.

:::note

[Page.SetDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) takes priority over [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout).
:::

**Usage**

```csharp
Page.SetDefaultTimeout(timeout);
```

**Arguments**
- `timeout` float
  
  Maximum time in milliseconds. Pass `0` to disable timeout.

---

### SetExtraHTTPHeadersAsync {/* #page-set-extra-http-headers */}



The extra HTTP headers will be sent with every request the page initiates.

:::note

[Page.SetExtraHTTPHeadersAsync()](/api/class-page.mdx#page-set-extra-http-headers) does not guarantee the order of headers in the outgoing requests.
:::

**Usage**

```csharp
await Page.SetExtraHTTPHeadersAsync(headers);
```

**Arguments**
- `headers` IDictionary<string, string>
  
  An object containing additional HTTP headers to be sent with every request. All header values must be strings.

**Returns**
- void

---

### SetViewportSizeAsync {/* #page-set-viewport-size */}



In the case of multiple pages in a single browser, each page can have its own viewport size. However, [Browser.NewContextAsync()](/api/class-browser.mdx#browser-new-context) allows to set viewport size (and more) for all pages in the context at once.

[Page.SetViewportSizeAsync()](/api/class-page.mdx#page-set-viewport-size) will resize the page. A lot of websites don't expect phones to change size, so you should set the viewport size before navigating to the page. [Page.SetViewportSizeAsync()](/api/class-page.mdx#page-set-viewport-size) will also reset `screen` size, use [Browser.NewContextAsync()](/api/class-browser.mdx#browser-new-context) with `screen` and `viewport` parameters if you need better control of these properties.

**Usage**

```csharp
var page = await browser.NewPageAsync();
await page.SetViewportSizeAsync(640, 480);
await page.GotoAsync("https://www.microsoft.com");
```

**Arguments**
- `width` int 
  
  Page width in pixels.
- `height` int 
  
  Page height in pixels.

**Returns**
- void

---

### TitleAsync {/* #page-title */}



Returns the page's title.

**Usage**

```csharp
await Page.TitleAsync();
```

**Returns**
- string

---

### UnrouteAsync {/* #page-unroute */}



Removes a route created with [Page.RouteAsync()](/api/class-page.mdx#page-route). When [handler](/api/class-page.mdx#page-unroute-option-handler) is not specified, removes all routes for the [url](/api/class-page.mdx#page-unroute-option-url).

**Usage**

```csharp
await Page.UnrouteAsync(url, handler);
```

**Arguments**
- `url` string | Regex | Func<string, bool>
  
  A glob pattern, regex pattern, or predicate receiving URL to match while routing.
- `handler` Action<Route?> *(optional)*
  
  Optional handler function to route the request.

**Returns**
- void

---

### UnrouteAllAsync {/* #page-unroute-all */}



Removes all routes created with [Page.RouteAsync()](/api/class-page.mdx#page-route) and [Page.RouteFromHARAsync()](/api/class-page.mdx#page-route-from-har).

**Usage**

```csharp
await Page.UnrouteAllAsync(options);
```

**Arguments**
- `options` `PageUnrouteAllOptions?` *(optional)*
  - `Behavior` `enum UnrouteBehavior { Wait, IgnoreErrors, Default }?` *(optional)*
    
    Specifies whether to wait for already running handlers and what to do if they throw errors:
    * `'default'` - do not wait for current handler calls (if any) to finish, if unrouted handler throws, it may result in unhandled error
    * `'wait'` - wait for current handler calls (if any) to finish
    * `'ignoreErrors'` - do not wait for current handler calls (if any) to finish, all errors thrown by the handlers after unrouting are silently caught

**Returns**
- void

---

### Url {/* #page-url */}



**Usage**

```csharp
Page.Url
```

**Returns**
- string

---

### Video {/* #page-video */}



Video object associated with this page. Can be used to access the video file when using the `recordVideo` context option.

**Usage**

```csharp
Page.Video
```

**Returns**
- Video?

---

### ViewportSize {/* #page-viewport-size */}



**Usage**

```csharp
Page.ViewportSize
```

**Returns**
- ViewportSize?
  - `width` int
    
    page width in pixels.
  - `height` int
    
    page height in pixels.

---

### WaitForFunctionAsync {/* #page-wait-for-function */}



Returns when the [expression](/api/class-page.mdx#page-wait-for-function-option-expression) returns a truthy value. It resolves to a JSHandle of the truthy value.

**Usage**

The [Page.WaitForFunctionAsync()](/api/class-page.mdx#page-wait-for-function) can be used to observe viewport size change:

```csharp
using Microsoft.Playwright;
using System.Threading.Tasks;

class FrameExamples
{
  public static async Task WaitForFunction()
  {
    using var playwright = await Playwright.CreateAsync();
    await using var browser = await playwright.Webkit.LaunchAsync();
    var page = await browser.NewPageAsync();
    await page.SetViewportSizeAsync(50, 50);
    await page.MainFrame.WaitForFunctionAsync("window.innerWidth < 100");
  }
}
```

To pass an argument to the predicate of [Page.WaitForFunctionAsync()](/api/class-page.mdx#page-wait-for-function) function:

```csharp
var selector = ".foo";
await page.WaitForFunctionAsync("selector => !!document.querySelector(selector)", selector);
```

**Arguments**
- `expression` string
  
  JavaScript expression to be evaluated in the browser context. If the expression evaluates to a function, the function is automatically invoked.
- `arg` EvaluationArgument? *(optional)*
  
  Optional argument to pass to [expression](/api/class-page.mdx#page-wait-for-function-option-expression).
- `options` `PageWaitForFunctionOptions?` *(optional)*
  - `PollingInterval` float? *(optional)*
    
    If specified, then it is treated as an interval in milliseconds at which the function would be executed. By default if the option is not specified [expression](/api/class-page.mdx#page-wait-for-function-option-expression) is executed in `requestAnimationFrame` callback.
  - `Timeout` float? *(optional)*
    
    Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- JSHandle

---

### WaitForLoadStateAsync {/* #page-wait-for-load-state */}



Returns when the required load state has been reached.

This resolves when the page reaches a required load state, `load` by default. The navigation must have been committed when this method is called. If current document has already reached the required state, resolves immediately.

:::note

Most of the time, this method is not needed because Playwright [auto-waits before every action](../actionability.mdx).
:::

**Usage**

```csharp
await page.GetByRole(AriaRole.Button).ClickAsync(); // Click triggers navigation.
await page.WaitForLoadStateAsync(); // The promise resolves after 'load' event.
```

```csharp
var popup = await page.RunAndWaitForPopupAsync(async () =>
{
    await page.GetByRole(AriaRole.Button).ClickAsync(); // click triggers the popup
});
// Wait for the "DOMContentLoaded" event.
await popup.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
Console.WriteLine(await popup.TitleAsync()); // popup is ready to use.
```

**Arguments**
- `state` `enum LoadState { Load, DOMContentLoaded, NetworkIdle }?` *(optional)*
  
  Optional load state to wait for, defaults to `load`. If the state has been already reached while loading current document, the method resolves immediately. Can be one of:
  * `'load'` - wait for the `load` event to be fired.
  * `'domcontentloaded'` - wait for the `DOMContentLoaded` event to be fired.
  * `'networkidle'` - **DISCOURAGED** wait until there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
- `options` `PageWaitForLoadStateOptions?` *(optional)*
  - `Timeout` float? *(optional)*
    
    Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [Page.SetDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- void

---

### WaitForURLAsync {/* #page-wait-for-url */}



Waits for the main frame to navigate to the given URL.

**Usage**

```csharp
await page.ClickAsync("a.delayed-navigation"); // clicking the link will indirectly cause a navigation
await page.WaitForURLAsync("**/target.html");
```

**Arguments**
- `url` string | Regex | Func<string, bool>
  
  A glob pattern, regex pattern, or predicate receiving URL to match while waiting for the navigation. Note that if the parameter is a string without wildcard characters, the method will wait for navigation to URL that is exactly equal to the string.
- `options` `PageWaitForURLOptions?` *(optional)*
  - `Timeout` float? *(optional)*
    
    Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [Page.SetDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `WaitUntil` `enum WaitUntilState { Load, DOMContentLoaded, NetworkIdle, Commit }?` *(optional)*
    
    When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
    * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- void

---

### Workers {/* #page-workers */}



This method returns all of the dedicated [WebWorkers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) associated with the page.

:::note

This does not contain ServiceWorkers
:::

**Usage**

```csharp
Page.Workers
```

**Returns**
- IReadOnlyList<Worker>

---

## Properties

### APIRequest {/* #page-request */}



API testing helper associated with this page. This method returns the same instance as [BrowserContext.APIRequest](/api/class-browsercontext.mdx#browser-context-request) on the page's context. See [BrowserContext.APIRequest](/api/class-browsercontext.mdx#browser-context-request) for more details.

**Usage**

```csharp
Page.APIRequest
```

**Type**
- APIRequestContext

---

### Clock {/* #page-clock */}



Playwright has ability to mock clock and passage of time.

**Usage**

```csharp
Page.Clock
```

**Type**
- Clock

---

### Keyboard {/* #page-keyboard */}



**Usage**

```csharp
Page.Keyboard
```

**Type**
- Keyboard

---

### LocalStorage {/* #page-local-storage */}



Provides access to the page's `localStorage` for the current origin. See WebStorage.

**Usage**

```csharp
Page.LocalStorage
```

**Type**
- WebStorage

---

### Mouse {/* #page-mouse */}



**Usage**

```csharp
Page.Mouse
```

**Type**
- Mouse

---

### Screencast {/* #page-screencast */}



Screencast object associated with this page.

**Usage**

**Type**
- Screencast

---

### SessionStorage {/* #page-session-storage */}



Provides access to the page's `sessionStorage` for the current origin. See WebStorage.

**Usage**

```csharp
Page.SessionStorage
```

**Type**
- WebStorage

---

### Touchscreen {/* #page-touchscreen */}



**Usage**

```csharp
Page.Touchscreen
```

**Type**
- Touchscreen

---

## Events

### event Close {/* #page-event-close */}



Emitted when the page closes.

**Usage**

```csharp
Page.Close += async (_, page) => {};
```

**Event data**
- Page

---

### event Console {/* #page-event-console */}



Emitted when JavaScript within the page calls one of console API methods, e.g. `console.log` or `console.dir`.

The arguments passed into `console.log` are available on the ConsoleMessage event handler argument.

**Usage**

```csharp
page.Console += async (_, msg) =>
{
    foreach (var arg in msg.Args)
        Console.WriteLine(await arg.JsonValueAsync<object>());
};

await page.EvaluateAsync("console.log('hello', 5, { foo: 'bar' })");
```

**Event data**
- ConsoleMessage

---

### event Crash {/* #page-event-crash */}



Emitted when the page crashes. Browser pages might crash if they try to allocate too much memory. When the page crashes, ongoing and subsequent operations will throw.

The most common way to deal with crashes is to catch an exception:

```csharp
try {
  // Crash might happen during a click.
  await page.ClickAsync("button");
  // Or while waiting for an event.
  await page.WaitForPopup();
} catch (PlaywrightException e) {
  // When the page crashes, exception message contains "crash".
}
```

**Usage**

```csharp
Page.Crash += async (_, page) => {};
```

**Event data**
- Page

---

### event Dialog {/* #page-event-dialog */}



Emitted when a JavaScript dialog appears, such as `alert`, `prompt`, `confirm` or `beforeunload`. Listener **must** either [Dialog.AcceptAsync()](/api/class-dialog.mdx#dialog-accept) or [Dialog.DismissAsync()](/api/class-dialog.mdx#dialog-dismiss) the dialog - otherwise the page will [freeze](https://developer.mozilla.org/en-US/docs/Web/JavaScript/EventLoop#never_blocking) waiting for the dialog, and actions like click will never finish.

**Usage**

```csharp
page.RequestFailed += (_, request) =>
{
    Console.WriteLine(request.Url + " " + request.Failure);
};
```

:::note
When no [Page.Dialog](/api/class-page.mdx#page-event-dialog) or [BrowserContext.Dialog](/api/class-browsercontext.mdx#browser-context-event-dialog) listeners are present, all dialogs are automatically dismissed.
:::

**Event data**
- Dialog

---

### event DOMContentLoaded {/* #page-event-dom-content-loaded */}



Emitted when the JavaScript [`DOMContentLoaded`](https://developer.mozilla.org/en-US/docs/Web/Events/DOMContentLoaded) event is dispatched.

**Usage**

```csharp
Page.DOMContentLoaded += async (_, page) => {};
```

**Event data**
- Page

---

### event Download {/* #page-event-download */}



Emitted when attachment download started. User can access basic file operations on downloaded content via the passed Download instance.

**Usage**

```csharp
Page.Download += async (_, download) => {};
```

**Event data**
- Download

---

### event FileChooser {/* #page-event-file-chooser */}



Emitted when a file chooser is supposed to appear, such as after clicking the  `<input type=file>`. Playwright can respond to it via setting the input files using [FileChooser.SetFilesAsync()](/api/class-filechooser.mdx#file-chooser-set-files) that can be uploaded after that.

```csharp
page.FileChooser += (_, fileChooser) =>
{
    fileChooser.SetFilesAsync(@"C:\temp\myfile.pdf");
};
```

**Usage**

```csharp
Page.FileChooser += async (_, fileChooser) => {};
```

**Event data**
- FileChooser

---

### event FrameAttached {/* #page-event-frame-attached */}



Emitted when a frame is attached.

**Usage**

```csharp
Page.FrameAttached += async (_, frame) => {};
```

**Event data**
- Frame

---

### event FrameDetached {/* #page-event-frame-detached */}



Emitted when a frame is detached.

**Usage**

```csharp
Page.FrameDetached += async (_, frame) => {};
```

**Event data**
- Frame

---

### event FrameNavigated {/* #page-event-frame-navigated */}



Emitted when a frame is navigated to a new url.

**Usage**

```csharp
Page.FrameNavigated += async (_, frame) => {};
```

**Event data**
- Frame

---

### event Load {/* #page-event-load */}



Emitted when the JavaScript [`load`](https://developer.mozilla.org/en-US/docs/Web/Events/load) event is dispatched.

**Usage**

```csharp
Page.Load += async (_, page) => {};
```

**Event data**
- Page

---

### event PageError {/* #page-event-page-error */}



Emitted when an uncaught exception happens within the page.

```csharp
// Log all uncaught errors to the terminal
page.PageError += (_, exception) =>
{
  Console.WriteLine("Uncaught exception: " + exception);
};
```

**Usage**

```csharp
Page.PageError += async (_, value) => {};
```

**Event data**
- string

---

### event Popup {/* #page-event-popup */}



Emitted when the page opens a new tab or window. This event is emitted in addition to the [BrowserContext.Page](/api/class-browsercontext.mdx#browser-context-event-page), but only for popups relevant to this page.

The earliest moment that page is available is when it has navigated to the initial url. For example, when opening a popup with `window.open('http://example.com')`, this event will fire when the network request to "http://example.com" is done and its response has started loading in the popup. If you would like to route/listen to this network request, use [BrowserContext.RouteAsync()](/api/class-browsercontext.mdx#browser-context-route) and [BrowserContext.Request](/api/class-browsercontext.mdx#browser-context-event-request) respectively instead of similar methods on the Page.

```csharp
var popup = await page.RunAndWaitForPopupAsync(async () =>
{
    await page.GetByText("open the popup").ClickAsync();
});
Console.WriteLine(await popup.EvaluateAsync<string>("location.href"));
```

:::note
Use [Page.WaitForLoadStateAsync()](/api/class-page.mdx#page-wait-for-load-state) to wait until the page gets to a particular state (you should not need it in most cases).
:::

**Usage**

```csharp
Page.Popup += async (_, page) => {};
```

**Event data**
- Page

---

### event Request {/* #page-event-request */}



Emitted when a page issues a request. The request object is read-only. In order to intercept and mutate requests, see [Page.RouteAsync()](/api/class-page.mdx#page-route) or [BrowserContext.RouteAsync()](/api/class-browsercontext.mdx#browser-context-route).

**Usage**

```csharp
Page.Request += async (_, request) => {};
```

**Event data**
- Request

---

### event RequestFailed {/* #page-event-request-failed */}



Emitted when a request fails, for example by timing out.

:::note

HTTP Error responses, such as 404 or 503, are still successful responses from HTTP standpoint, so request will complete with [Page.RequestFinished](/api/class-page.mdx#page-event-request-finished) event and not with [Page.RequestFailed](/api/class-page.mdx#page-event-request-failed). A request will only be considered failed when the client cannot get an HTTP response from the server, e.g. due to network error net::ERR_FAILED.
:::

**Usage**

```csharp
Page.RequestFailed += async (_, request) => {};
```

**Event data**
- Request

---

### event RequestFinished {/* #page-event-request-finished */}



Emitted when a request finishes successfully after downloading the response body. For a successful response, the sequence of events is `request`, `response` and `requestfinished`.

**Usage**

```csharp
Page.RequestFinished += async (_, request) => {};
```

**Event data**
- Request

---

### event Response {/* #page-event-response */}



Emitted when response status and headers are received for a request. For a successful response, the sequence of events is `request`, `response` and `requestfinished`.

**Usage**

```csharp
Page.Response += async (_, response) => {};
```

**Event data**
- Response

---

### event WebSocket {/* #page-event-web-socket */}



Emitted when WebSocket request is sent.

**Usage**

```csharp
Page.WebSocket += async (_, webSocket) => {};
```

**Event data**
- WebSocket

---

### event Worker {/* #page-event-worker */}



Emitted when a dedicated [WebWorker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) is spawned by the page.

**Usage**

```csharp
Page.Worker += async (_, worker) => {};
```

**Event data**
- Worker

---

## Deprecated

### CheckAsync {/* #page-check */}



:::warningDiscouraged

Use locator-based [Locator.CheckAsync()](/api/class-locator.mdx#locator-check) instead. Read more about [locators](../locators.mdx).

:::


This method checks an element matching [selector](/api/class-page.mdx#page-check-option-selector) by performing the following steps:
1. Find an element matching [selector](/api/class-page.mdx#page-check-option-selector). If there is none, wait until a matching element is attached to the DOM.
1. Ensure that matched element is a checkbox or a radio input. If not, this method throws. If the element is already checked, this method returns immediately.
1. Wait for [actionability](../actionability.mdx) checks on the matched element, unless [Force](/api/class-page.mdx#page-check-option-force) option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [Page.Mouse](/api/class-page.mdx#page-mouse) to click in the center of the element.
1. Ensure that the element is now checked. If not, this method throws.

When all steps combined have not finished during the specified [Timeout](/api/class-page.mdx#page-check-option-timeout), this method throws a TimeoutError. Passing zero timeout disables this.

**Usage**

```csharp
await Page.CheckAsync(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `PageCheckOptions?` *(optional)*
  - `Force` bool? *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `NoWaitAfter` bool? *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `Position` Position? *(optional)* 
    - `X` float
      
      
    - `Y` float
      
      
    A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
  - `Scroll` `enum ScrollMode { Auto, None }?` *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `Trial` bool? *(optional)* 
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it.

**Returns**
- void

---

### ClickAsync {/* #page-click */}



:::warningDiscouraged

Use locator-based [Locator.ClickAsync()](/api/class-locator.mdx#locator-click) instead. Read more about [locators](../locators.mdx).

:::


This method clicks an element matching [selector](/api/class-page.mdx#page-click-option-selector) by performing the following steps:
1. Find an element matching [selector](/api/class-page.mdx#page-click-option-selector). If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](../actionability.mdx) checks on the matched element, unless [Force](/api/class-page.mdx#page-click-option-force) option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [Page.Mouse](/api/class-page.mdx#page-mouse) to click in the center of the element, or the specified [Position](/api/class-page.mdx#page-click-option-position).
1. Wait for initiated navigations to either succeed or fail, unless [NoWaitAfter](/api/class-page.mdx#page-click-option-no-wait-after) option is set.

When all steps combined have not finished during the specified [Timeout](/api/class-page.mdx#page-click-option-timeout), this method throws a TimeoutError. Passing zero timeout disables this.

**Usage**

```csharp
await Page.ClickAsync(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `PageClickOptions?` *(optional)*
  - `Button` `enum MouseButton { Left, Right, Middle }?` *(optional)*
    
    Defaults to `left`.
  - `ClickCount` int? *(optional)*
    
    defaults to 1. See UIEvent.detail.
  - `Delay` float? *(optional)*
    
    Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `Force` bool? *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `Modifiers` IEnumerable?<`enum KeyboardModifier { Alt, Control, ControlOrMeta, Meta, Shift }`> *(optional)*
    
    Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used. "ControlOrMeta" resolves to "Control" on Windows and Linux and to "Meta" on macOS.
  - `NoWaitAfter` bool? *(optional)*
    
    :::warningDeprecated
    This option will default to `true` in the future.
    :::
    
    
    Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `Position` Position? *(optional)*
    - `X` float
      
      
    - `Y` float
      
      
    A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
  - `Scroll` `enum ScrollMode { Auto, None }?` *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `Trial` bool? *(optional)* 
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it. Note that keyboard `modifiers` will be pressed regardless of `trial` to allow testing elements which are only visible when those keys are pressed.

**Returns**
- void

---

### DblClickAsync {/* #page-dblclick */}



:::warningDiscouraged

Use locator-based [Locator.DblClickAsync()](/api/class-locator.mdx#locator-dblclick) instead. Read more about [locators](../locators.mdx).

:::


This method double clicks an element matching [selector](/api/class-page.mdx#page-dblclick-option-selector) by performing the following steps:
1. Find an element matching [selector](/api/class-page.mdx#page-dblclick-option-selector). If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](../actionability.mdx) checks on the matched element, unless [Force](/api/class-page.mdx#page-dblclick-option-force) option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [Page.Mouse](/api/class-page.mdx#page-mouse) to double click in the center of the element, or the specified [Position](/api/class-page.mdx#page-dblclick-option-position).

When all steps combined have not finished during the specified [Timeout](/api/class-page.mdx#page-dblclick-option-timeout), this method throws a TimeoutError. Passing zero timeout disables this.

:::note

`page.dblclick()` dispatches two `click` events and a single `dblclick` event.
:::

**Usage**

```csharp
await Page.DblClickAsync(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `PageDblClickOptions?` *(optional)*
  - `Button` `enum MouseButton { Left, Right, Middle }?` *(optional)*
    
    Defaults to `left`.
  - `Delay` float? *(optional)*
    
    Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
  - `Force` bool? *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `Modifiers` IEnumerable?<`enum KeyboardModifier { Alt, Control, ControlOrMeta, Meta, Shift }`> *(optional)*
    
    Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used. "ControlOrMeta" resolves to "Control" on Windows and Linux and to "Meta" on macOS.
  - `NoWaitAfter` bool? *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `Position` Position? *(optional)*
    - `X` float
      
      
    - `Y` float
      
      
    A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
  - `Scroll` `enum ScrollMode { Auto, None }?` *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `Trial` bool? *(optional)* 
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it. Note that keyboard `modifiers` will be pressed regardless of `trial` to allow testing elements which are only visible when those keys are pressed.

**Returns**
- void

---

### DispatchEventAsync {/* #page-dispatch-event */}



:::warningDiscouraged

Use locator-based [Locator.DispatchEventAsync()](/api/class-locator.mdx#locator-dispatch-event) instead. Read more about [locators](../locators.mdx).

:::


The snippet below dispatches the `click` event on the element. Regardless of the visibility state of the element, `click` is dispatched. This is equivalent to calling [element.click()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click).

**Usage**

```csharp
await page.DispatchEventAsync("button#submit", "click");
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

```csharp
var dataTransfer = await page.EvaluateHandleAsync("() => new DataTransfer()");
await page.DispatchEventAsync("#source", "dragstart", new { dataTransfer });
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `type` string
  
  DOM event type: `"click"`, `"dragstart"`, etc.
- `eventInit` EvaluationArgument? *(optional)*
  
  Optional event-specific initialization properties.
- `options` `PageDispatchEventOptions?` *(optional)*
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- void

---

### EvalOnSelectorAsync {/* #page-eval-on-selector */}



:::warningDiscouraged

This method does not wait for the element to pass actionability checks and therefore can lead to the flaky tests. Use [Locator.EvaluateAsync()](/api/class-locator.mdx#locator-evaluate), other Locator helper methods or web-first assertions instead.

:::


The method finds an element matching the specified selector within the page and passes it as a first argument to [expression](/api/class-page.mdx#page-eval-on-selector-option-expression). If no elements match the selector, the method throws an error. Returns the value of [expression](/api/class-page.mdx#page-eval-on-selector-option-expression).

If [expression](/api/class-page.mdx#page-eval-on-selector-option-expression) returns a Promise, then [Page.EvalOnSelectorAsync()](/api/class-page.mdx#page-eval-on-selector) would wait for the promise to resolve and return its value.

**Usage**

```csharp
var searchValue = await page.EvalOnSelectorAsync<string>("#search", "el => el.value");
var preloadHref = await page.EvalOnSelectorAsync<string>("linkrel=preload", "el => el.href");
var html = await page.EvalOnSelectorAsync(".main-container", "(e, suffix) => e.outerHTML + suffix", "hello");
```

**Arguments**
- `selector` string
  
  A selector to query for.
- `expression` string
  
  JavaScript expression to be evaluated in the browser context. If the expression evaluates to a function, the function is automatically invoked.
- `arg` EvaluationArgument? *(optional)*
  
  Optional argument to pass to [expression](/api/class-page.mdx#page-eval-on-selector-option-expression).
- `options` `PageEvalOnSelectorOptions?` *(optional)*
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.

**Returns**
- object

---

### EvalOnSelectorAllAsync {/* #page-eval-on-selector-all */}



:::warningDiscouraged

In most cases, [Locator.EvaluateAllAsync()](/api/class-locator.mdx#locator-evaluate-all), other Locator helper methods and web-first assertions do a better job.

:::


The method finds all elements matching the specified selector within the page and passes an array of matched elements as a first argument to [expression](/api/class-page.mdx#page-eval-on-selector-all-option-expression). Returns the result of [expression](/api/class-page.mdx#page-eval-on-selector-all-option-expression) invocation.

If [expression](/api/class-page.mdx#page-eval-on-selector-all-option-expression) returns a Promise, then [Page.EvalOnSelectorAllAsync()](/api/class-page.mdx#page-eval-on-selector-all) would wait for the promise to resolve and return its value.

**Usage**

```csharp
var divsCount = await page.EvalOnSelectorAllAsync<bool>("div", "(divs, min) => divs.length >= min", 10);
```

**Arguments**
- `selector` string
  
  A selector to query for.
- `expression` string
  
  JavaScript expression to be evaluated in the browser context. If the expression evaluates to a function, the function is automatically invoked.
- `arg` EvaluationArgument? *(optional)*
  
  Optional argument to pass to [expression](/api/class-page.mdx#page-eval-on-selector-all-option-expression).

**Returns**
- object

---

### FillAsync {/* #page-fill */}



:::warningDiscouraged

Use locator-based [Locator.FillAsync()](/api/class-locator.mdx#locator-fill) instead. Read more about [locators](../locators.mdx).

:::


This method waits for an element matching [selector](/api/class-page.mdx#page-fill-option-selector), waits for [actionability](../actionability.mdx) checks, focuses the element, fills it and triggers an `input` event after filling. Note that you can pass an empty string to clear the input field.

If the target element is not an `<input>`, `<textarea>` or `contenteditable` element, this method throws an error. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), the control will be filled instead.

To send fine-grained keyboard events, use [Locator.PressSequentiallyAsync()](/api/class-locator.mdx#locator-press-sequentially).

**Usage**

```csharp
await Page.FillAsync(selector, value, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `value` string
  
  Value to fill for the `<input>`, `<textarea>` or `contenteditable` element.
- `options` `PageFillOptions?` *(optional)*
  - `Force` bool? *(optional)* 
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `NoWaitAfter` bool? *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- void

---

### FocusAsync {/* #page-focus */}



:::warningDiscouraged

Use locator-based [Locator.FocusAsync()](/api/class-locator.mdx#locator-focus) instead. Read more about [locators](../locators.mdx).

:::


This method fetches an element with [selector](/api/class-page.mdx#page-focus-option-selector) and focuses it. If there's no element matching [selector](/api/class-page.mdx#page-focus-option-selector), the method waits until a matching element appears in the DOM.

**Usage**

```csharp
await Page.FocusAsync(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `PageFocusOptions?` *(optional)*
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- void

---

### GetAttributeAsync {/* #page-get-attribute */}



:::warningDiscouraged

Use locator-based [Locator.GetAttributeAsync()](/api/class-locator.mdx#locator-get-attribute) instead. Read more about [locators](../locators.mdx).

:::


Returns element attribute value.

**Usage**

```csharp
await Page.GetAttributeAsync(selector, name, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `name` string
  
  Attribute name to get the value for.
- `options` `PageGetAttributeOptions?` *(optional)*
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- string?

---

### HoverAsync {/* #page-hover */}



:::warningDiscouraged

Use locator-based [Locator.HoverAsync()](/api/class-locator.mdx#locator-hover) instead. Read more about [locators](../locators.mdx).

:::


This method hovers over an element matching [selector](/api/class-page.mdx#page-hover-option-selector) by performing the following steps:
1. Find an element matching [selector](/api/class-page.mdx#page-hover-option-selector). If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](../actionability.mdx) checks on the matched element, unless [Force](/api/class-page.mdx#page-hover-option-force) option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [Page.Mouse](/api/class-page.mdx#page-mouse) to hover over the center of the element, or the specified [Position](/api/class-page.mdx#page-hover-option-position).

When all steps combined have not finished during the specified [Timeout](/api/class-page.mdx#page-hover-option-timeout), this method throws a TimeoutError. Passing zero timeout disables this.

**Usage**

```csharp
await Page.HoverAsync(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `PageHoverOptions?` *(optional)*
  - `Force` bool? *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `Modifiers` IEnumerable?<`enum KeyboardModifier { Alt, Control, ControlOrMeta, Meta, Shift }`> *(optional)*
    
    Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used. "ControlOrMeta" resolves to "Control" on Windows and Linux and to "Meta" on macOS.
  - `NoWaitAfter` bool? *(optional)* 
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `Position` Position? *(optional)*
    - `X` float
      
      
    - `Y` float
      
      
    A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
  - `Scroll` `enum ScrollMode { Auto, None }?` *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `Trial` bool? *(optional)* 
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it. Note that keyboard `modifiers` will be pressed regardless of `trial` to allow testing elements which are only visible when those keys are pressed.

**Returns**
- void

---

### InnerHTMLAsync {/* #page-inner-html */}



:::warningDiscouraged

Use locator-based [Locator.InnerHTMLAsync()](/api/class-locator.mdx#locator-inner-html) instead. Read more about [locators](../locators.mdx).

:::


Returns `element.innerHTML`.

**Usage**

```csharp
await Page.InnerHTMLAsync(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `PageInnerHTMLOptions?` *(optional)*
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- string

---

### InnerTextAsync {/* #page-inner-text */}



:::warningDiscouraged

Use locator-based [Locator.InnerTextAsync()](/api/class-locator.mdx#locator-inner-text) instead. Read more about [locators](../locators.mdx).

:::


Returns `element.innerText`.

**Usage**

```csharp
await Page.InnerTextAsync(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `PageInnerTextOptions?` *(optional)*
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- string

---

### InputValueAsync {/* #page-input-value */}



:::warningDiscouraged

Use locator-based [Locator.InputValueAsync()](/api/class-locator.mdx#locator-input-value) instead. Read more about [locators](../locators.mdx).

:::


Returns `input.value` for the selected `<input>` or `<textarea>` or `<select>` element.

Throws for non-input elements. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), returns the value of the control.

**Usage**

```csharp
await Page.InputValueAsync(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `PageInputValueOptions?` *(optional)*
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- string

---

### IsCheckedAsync {/* #page-is-checked */}



:::warningDiscouraged

Use locator-based [Locator.IsCheckedAsync()](/api/class-locator.mdx#locator-is-checked) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is checked. Throws if the element is not a checkbox or radio input.

**Usage**

```csharp
await Page.IsCheckedAsync(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `PageIsCheckedOptions?` *(optional)*
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- bool

---

### IsDisabledAsync {/* #page-is-disabled */}



:::warningDiscouraged

Use locator-based [Locator.IsDisabledAsync()](/api/class-locator.mdx#locator-is-disabled) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is disabled, the opposite of [enabled](../actionability.mdx#enabled).

**Usage**

```csharp
await Page.IsDisabledAsync(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `PageIsDisabledOptions?` *(optional)*
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- bool

---

### IsEditableAsync {/* #page-is-editable */}



:::warningDiscouraged

Use locator-based [Locator.IsEditableAsync()](/api/class-locator.mdx#locator-is-editable) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is [editable](../actionability.mdx#editable).

**Usage**

```csharp
await Page.IsEditableAsync(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `PageIsEditableOptions?` *(optional)*
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- bool

---

### IsEnabledAsync {/* #page-is-enabled */}



:::warningDiscouraged

Use locator-based [Locator.IsEnabledAsync()](/api/class-locator.mdx#locator-is-enabled) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is [enabled](../actionability.mdx#enabled).

**Usage**

```csharp
await Page.IsEnabledAsync(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `PageIsEnabledOptions?` *(optional)*
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- bool

---

### IsHiddenAsync {/* #page-is-hidden */}



:::warningDiscouraged

Use locator-based [Locator.IsHiddenAsync()](/api/class-locator.mdx#locator-is-hidden) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is hidden, the opposite of [visible](../actionability.mdx#visible).  [selector](/api/class-page.mdx#page-is-hidden-option-selector) that does not match any elements is considered hidden.

**Usage**

```csharp
await Page.IsHiddenAsync(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `PageIsHiddenOptions?` *(optional)*
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    :::warningDeprecated
    This option is ignored. [Page.IsHiddenAsync()](/api/class-page.mdx#page-is-hidden) does not wait for the element to become hidden and returns immediately.
    :::
    

**Returns**
- bool

---

### IsVisibleAsync {/* #page-is-visible */}



:::warningDiscouraged

Use locator-based [Locator.IsVisibleAsync()](/api/class-locator.mdx#locator-is-visible) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is [visible](../actionability.mdx#visible). [selector](/api/class-page.mdx#page-is-visible-option-selector) that does not match any elements is considered not visible.

**Usage**

```csharp
await Page.IsVisibleAsync(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `PageIsVisibleOptions?` *(optional)*
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    :::warningDeprecated
    This option is ignored. [Page.IsVisibleAsync()](/api/class-page.mdx#page-is-visible) does not wait for the element to become visible and returns immediately.
    :::
    

**Returns**
- bool

---

### PressAsync {/* #page-press */}



:::warningDiscouraged

Use locator-based [Locator.PressAsync()](/api/class-locator.mdx#locator-press) instead. Read more about [locators](../locators.mdx).

:::


Focuses the element, and then uses [Keyboard.DownAsync()](/api/class-keyboard.mdx#keyboard-down) and [Keyboard.UpAsync()](/api/class-keyboard.mdx#keyboard-up).

[key](/api/class-page.mdx#page-press-option-key) can specify the intended [keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) value or a single character to generate the text for. A superset of the [key](/api/class-page.mdx#page-press-option-key) values can be found [here](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values). Examples of the keys are:

`F1` - `F12`, `Digit0`- `Digit9`, `KeyA`- `KeyZ`, `Backquote`, `Minus`, `Equal`, `Backslash`, `Backspace`, `Tab`, `Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`, `PageDown`, `PageUp`, `ArrowRight`, `ArrowUp`, etc.

Following modification shortcuts are also supported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`, `ControlOrMeta`. `ControlOrMeta` resolves to `Control` on Windows and Linux and to `Meta` on macOS.

Holding down `Shift` will type the text that corresponds to the [key](/api/class-page.mdx#page-press-option-key) in the upper case.

If [key](/api/class-page.mdx#page-press-option-key) is a single character, it is case-sensitive, so the values `a` and `A` will generate different respective texts.

Shortcuts such as `key: "Control+o"`, `key: "Control++` or `key: "Control+Shift+T"` are supported as well. When specified with the modifier, modifier is pressed and being held while the subsequent key is being pressed.

**Usage**

```csharp
var page = await browser.NewPageAsync();
await page.GotoAsync("https://keycode.info");
await page.PressAsync("body", "A");
await page.ScreenshotAsync(new() { Path = "A.png" });
await page.PressAsync("body", "ArrowLeft");
await page.ScreenshotAsync(new() { Path = "ArrowLeft.png" });
await page.PressAsync("body", "Shift+O");
await page.ScreenshotAsync(new() { Path = "O.png" });
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `key` string
  
  Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.
- `options` `PagePressOptions?` *(optional)*
  - `Delay` float? *(optional)*
    
    Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.
  - `NoWaitAfter` bool? *(optional)*
    
    :::warningDeprecated
    This option will default to `true` in the future.
    :::
    
    
    Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- void

---

### QuerySelectorAsync {/* #page-query-selector */}



:::warningDiscouraged

Use locator-based [Page.Locator()](/api/class-page.mdx#page-locator) instead. Read more about [locators](../locators.mdx).

:::


The method finds an element matching the specified selector within the page. If no elements match the selector, the return value resolves to `null`. To wait for an element on the page, use [Locator.WaitForAsync()](/api/class-locator.mdx#locator-wait-for).

**Usage**

```csharp
await Page.QuerySelectorAsync(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to query for.
- `options` `PageQuerySelectorOptions?` *(optional)*
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.

**Returns**
- ElementHandle?

---

### QuerySelectorAllAsync {/* #page-query-selector-all */}



:::warningDiscouraged

Use locator-based [Page.Locator()](/api/class-page.mdx#page-locator) instead. Read more about [locators](../locators.mdx).

:::


The method finds all elements matching the specified selector within the page. If no elements match the selector, the return value resolves to `[]`.

**Usage**

```csharp
await Page.QuerySelectorAllAsync(selector);
```

**Arguments**
- `selector` string
  
  A selector to query for.

**Returns**
- IReadOnlyList<ElementHandle>

---

### RunAndWaitForNavigationAsync {/* #page-wait-for-navigation */}



:::warningDeprecated

This method is inherently racy, please use [Page.WaitForURLAsync()](/api/class-page.mdx#page-wait-for-url) instead.

:::


Waits for the main frame navigation and returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. In case of navigation to a different anchor or navigation due to History API usage, the navigation will resolve with `null`.

**Usage**

This resolves when the page navigates to a new URL or reloads. It is useful for when you run code which will indirectly cause the page to navigate. e.g. The click target has an `onclick` handler that triggers navigation from a `setTimeout`. Consider this example:

```csharp
await page.RunAndWaitForNavigationAsync(async () =>
{
    // This action triggers the navigation after a timeout.
    await page.GetByText("Navigate after timeout").ClickAsync();
});

// The method continues after navigation has finished
```

:::note
Usage of the [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) to change the URL is considered a navigation.
:::

**Arguments**
- `action` Func<Task> 
  
  Action that triggers the event.
- `options` `PageRunAndWaitForNavigationOptions?` *(optional)*
  - `Timeout` float? *(optional)*
    
    Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [Page.SetDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `Url|UrlRegex|UrlFunc` string? | Regex? | Func<string?, bool> *(optional)*
    
    A glob pattern, regex pattern, or predicate receiving URL to match while waiting for the navigation. Note that if the parameter is a string without wildcard characters, the method will wait for navigation to URL that is exactly equal to the string.
  - `WaitUntil` `enum WaitUntilState { Load, DOMContentLoaded, NetworkIdle, Commit }?` *(optional)*
    
    When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
    * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- Response?

---

### WaitForNavigationAsync {/* #page-wait-for-navigation */}



:::warningDeprecated

This method is inherently racy, please use [Page.WaitForURLAsync()](/api/class-page.mdx#page-wait-for-url) instead.

:::


Waits for the main frame navigation and returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. In case of navigation to a different anchor or navigation due to History API usage, the navigation will resolve with `null`.

**Usage**

This resolves when the page navigates to a new URL or reloads. It is useful for when you run code which will indirectly cause the page to navigate. e.g. The click target has an `onclick` handler that triggers navigation from a `setTimeout`. Consider this example:

```csharp
await page.RunAndWaitForNavigationAsync(async () =>
{
    // This action triggers the navigation after a timeout.
    await page.GetByText("Navigate after timeout").ClickAsync();
});

// The method continues after navigation has finished
```

:::note
Usage of the [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) to change the URL is considered a navigation.
:::

**Arguments**
- `options` `PageRunAndWaitForNavigationOptions?` *(optional)*
  - `Timeout` float? *(optional)*
    
    Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultNavigationTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [Page.SetDefaultNavigationTimeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `Url|UrlRegex|UrlFunc` string? | Regex? | Func<string?, bool> *(optional)*
    
    A glob pattern, regex pattern, or predicate receiving URL to match while waiting for the navigation. Note that if the parameter is a string without wildcard characters, the method will wait for navigation to URL that is exactly equal to the string.
  - `WaitUntil` `enum WaitUntilState { Load, DOMContentLoaded, NetworkIdle, Commit }?` *(optional)*
    
    When to consider operation succeeded, defaults to `load`. Events can be either:
    * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
    * `'load'` - consider operation to be finished when the `load` event is fired.
    * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
    * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- Response?

---

### SelectOptionAsync {/* #page-select-option */}



:::warningDiscouraged

Use locator-based [Locator.SelectOptionAsync()](/api/class-locator.mdx#locator-select-option) instead. Read more about [locators](../locators.mdx).

:::


This method waits for an element matching [selector](/api/class-page.mdx#page-select-option-option-selector), waits for [actionability](../actionability.mdx) checks, waits until all specified options are present in the `<select>` element and selects these options.

If the target element is not a `<select>` element, this method throws an error. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), the control will be used instead.

Returns the array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected.

**Usage**

```csharp
// Single selection matching the value or label
await page.SelectOptionAsync("select#colors", new[] { "blue" });
// single selection matching both the value and the label
await page.SelectOptionAsync("select#colors", new[] { new SelectOptionValue() { Label = "blue" } });
// multiple
await page.SelectOptionAsync("select#colors", new[] { "red", "green", "blue" });
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `values` string | ElementHandle | IEnumerable | `SelectOption` | IEnumerable | IEnumerable?
  - `Value` string? *(optional)*
    
    Matches by `option.value`. Optional.
  - `Label` string? *(optional)*
    
    Matches by `option.label`. Optional.
  - `Index` int? *(optional)*
    
    Matches by the index. Optional.
  
  Options to select. If the `<select>` has the `multiple` attribute, all matching options are selected, otherwise only the first option matching one of the passed options is selected. String values are matching both values and labels. Option is considered matching if all specified properties match.
- `options` `PageSelectOptionOptions?` *(optional)*
  - `Force` bool? *(optional)* 
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `NoWaitAfter` bool? *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- IReadOnlyList<string>

---

### SetCheckedAsync {/* #page-set-checked */}



:::warningDiscouraged

Use locator-based [Locator.SetCheckedAsync()](/api/class-locator.mdx#locator-set-checked) instead. Read more about [locators](../locators.mdx).

:::


This method checks or unchecks an element matching [selector](/api/class-page.mdx#page-set-checked-option-selector) by performing the following steps:
1. Find an element matching [selector](/api/class-page.mdx#page-set-checked-option-selector). If there is none, wait until a matching element is attached to the DOM.
1. Ensure that matched element is a checkbox or a radio input. If not, this method throws.
1. If the element already has the right checked state, this method returns immediately.
1. Wait for [actionability](../actionability.mdx) checks on the matched element, unless [Force](/api/class-page.mdx#page-set-checked-option-force) option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [Page.Mouse](/api/class-page.mdx#page-mouse) to click in the center of the element.
1. Ensure that the element is now checked or unchecked. If not, this method throws.

When all steps combined have not finished during the specified [Timeout](/api/class-page.mdx#page-set-checked-option-timeout), this method throws a TimeoutError. Passing zero timeout disables this.

**Usage**

```csharp
await Page.SetCheckedAsync(selector, checked, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `checkedState` bool
  
  Whether to check or uncheck the checkbox.
- `options` `PageSetCheckedOptions?` *(optional)*
  - `Force` bool? *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `NoWaitAfter` bool? *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `Position` Position? *(optional)*
    - `X` float
      
      
    - `Y` float
      
      
    A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
  - `Scroll` `enum ScrollMode { Auto, None }?` *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `Strict` bool? *(optional)*
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `Trial` bool? *(optional)*
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it.

**Returns**
- void

---

### SetInputFilesAsync {/* #page-set-input-files */}



:::warningDiscouraged

Use locator-based [Locator.SetInputFilesAsync()](/api/class-locator.mdx#locator-set-input-files) instead. Read more about [locators](../locators.mdx).

:::


Sets the value of the file input to these file paths or files. If some of the `filePaths` are relative paths, then they are resolved relative to the current working directory. For empty array, clears the selected files. For inputs with a `webkitdirectory` attribute, only a single directory path is supported.

This method expects [selector](/api/class-page.mdx#page-set-input-files-option-selector) to point to an [input element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input). However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), targets the control instead.

**Usage**

```csharp
await Page.SetInputFilesAsync(selector, files, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `files` string | IEnumerable<string> | `FilePayload` | IEnumerable<`FilePayload`>
  - `Name` string
    
    File name
  - `MimeType` string
    
    File type
  - `Buffer` byte&#91;&#93;
    
    File content
- `options` `PageSetInputFilesOptions?` *(optional)*
  - `NoWaitAfter` bool? *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- void

---

### TapAsync {/* #page-tap */}



:::warningDiscouraged

Use locator-based [Locator.TapAsync()](/api/class-locator.mdx#locator-tap) instead. Read more about [locators](../locators.mdx).

:::


This method taps an element matching [selector](/api/class-page.mdx#page-tap-option-selector) by performing the following steps:
1. Find an element matching [selector](/api/class-page.mdx#page-tap-option-selector). If there is none, wait until a matching element is attached to the DOM.
1. Wait for [actionability](../actionability.mdx) checks on the matched element, unless [Force](/api/class-page.mdx#page-tap-option-force) option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [Page.Touchscreen](/api/class-page.mdx#page-touchscreen) to tap the center of the element, or the specified [Position](/api/class-page.mdx#page-tap-option-position).

When all steps combined have not finished during the specified [Timeout](/api/class-page.mdx#page-tap-option-timeout), this method throws a TimeoutError. Passing zero timeout disables this.

:::note

[Page.TapAsync()](/api/class-page.mdx#page-tap) will throw if the [HasTouch](/api/class-browser.mdx#browser-new-context-option-has-touch) option of the browser context is false.
:::

**Usage**

```csharp
await Page.TapAsync(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `PageTapOptions?` *(optional)*
  - `Force` bool? *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `Modifiers` IEnumerable?<`enum KeyboardModifier { Alt, Control, ControlOrMeta, Meta, Shift }`> *(optional)*
    
    Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used. "ControlOrMeta" resolves to "Control" on Windows and Linux and to "Meta" on macOS.
  - `NoWaitAfter` bool? *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `Position` Position? *(optional)*
    - `X` float
      
      
    - `Y` float
      
      
    A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
  - `Scroll` `enum ScrollMode { Auto, None }?` *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `Trial` bool? *(optional)* 
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it. Note that keyboard `modifiers` will be pressed regardless of `trial` to allow testing elements which are only visible when those keys are pressed.

**Returns**
- void

---

### TextContentAsync {/* #page-text-content */}



:::warningDiscouraged

Use locator-based [Locator.TextContentAsync()](/api/class-locator.mdx#locator-text-content) instead. Read more about [locators](../locators.mdx).

:::


Returns `element.textContent`.

**Usage**

```csharp
await Page.TextContentAsync(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `PageTextContentOptions?` *(optional)*
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- string?

---

### TypeAsync {/* #page-type */}



:::warningDeprecated

In most cases, you should use [Locator.FillAsync()](/api/class-locator.mdx#locator-fill) instead. You only need to press keys one by one if there is special keyboard handling on the page - in this case use [Locator.PressSequentiallyAsync()](/api/class-locator.mdx#locator-press-sequentially).

:::


Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text. `page.type` can be used to send fine-grained keyboard events. To fill values in form fields, use [Page.FillAsync()](/api/class-page.mdx#page-fill).

To press a special key, like `Control` or `ArrowDown`, use [Keyboard.PressAsync()](/api/class-keyboard.mdx#keyboard-press).

**Usage**

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `text` string
  
  A text to type into a focused element.
- `options` `PageTypeOptions?` *(optional)*
  - `Delay` float? *(optional)*
    
    Time to wait between key presses in milliseconds. Defaults to 0.
  - `NoWaitAfter` bool? *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- void

---

### UncheckAsync {/* #page-uncheck */}



:::warningDiscouraged

Use locator-based [Locator.UncheckAsync()](/api/class-locator.mdx#locator-uncheck) instead. Read more about [locators](../locators.mdx).

:::


This method unchecks an element matching [selector](/api/class-page.mdx#page-uncheck-option-selector) by performing the following steps:
1. Find an element matching [selector](/api/class-page.mdx#page-uncheck-option-selector). If there is none, wait until a matching element is attached to the DOM.
1. Ensure that matched element is a checkbox or a radio input. If not, this method throws. If the element is already unchecked, this method returns immediately.
1. Wait for [actionability](../actionability.mdx) checks on the matched element, unless [Force](/api/class-page.mdx#page-uncheck-option-force) option is set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [Page.Mouse](/api/class-page.mdx#page-mouse) to click in the center of the element.
1. Ensure that the element is now unchecked. If not, this method throws.

When all steps combined have not finished during the specified [Timeout](/api/class-page.mdx#page-uncheck-option-timeout), this method throws a TimeoutError. Passing zero timeout disables this.

**Usage**

```csharp
await Page.UncheckAsync(selector, options);
```

**Arguments**
- `selector` string
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `options` `PageUncheckOptions?` *(optional)*
  - `Force` bool? *(optional)*
    
    Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
  - `NoWaitAfter` bool? *(optional)*
    
    :::warningDeprecated
    This option has no effect.
    :::
    
    
    This option has no effect.
  - `Position` Position? *(optional)* 
    - `X` float
      
      
    - `Y` float
      
      
    A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
  - `Scroll` `enum ScrollMode { Auto, None }?` *(optional)* 
    
    Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.
  - `Trial` bool? *(optional)* 
    
    When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it.

**Returns**
- void

---

### WaitForSelectorAsync {/* #page-wait-for-selector */}



:::warningDiscouraged

Use web assertions that assert visibility or a locator-based [Locator.WaitForAsync()](/api/class-locator.mdx#locator-wait-for) instead. Read more about [locators](../locators.mdx).

:::


Returns when element specified by selector satisfies [State](/api/class-page.mdx#page-wait-for-selector-option-state) option. Returns `null` if waiting for `hidden` or `detached`.

:::note

Playwright automatically waits for element to be ready before performing an action. Using Locator objects and web-first assertions makes the code wait-for-selector-free.
:::

Wait for the [selector](/api/class-page.mdx#page-wait-for-selector-option-selector) to satisfy [State](/api/class-page.mdx#page-wait-for-selector-option-state) option (either appear/disappear from dom, or become visible/hidden). If at the moment of calling the method [selector](/api/class-page.mdx#page-wait-for-selector-option-selector) already satisfies the condition, the method will return immediately. If the selector doesn't satisfy the condition for the [Timeout](/api/class-page.mdx#page-wait-for-selector-option-timeout) milliseconds, the function will throw.

**Usage**

This method works across navigations:

```csharp
using Microsoft.Playwright;
using System;
using System.Threading.Tasks;

class FrameExamples
{
  public static async Task Images()
  {
      using var playwright = await Playwright.CreateAsync();
      await using var browser = await playwright.Chromium.LaunchAsync();
      var page = await browser.NewPageAsync();

      foreach (var currentUrl in new[] { "https://www.google.com", "https://bbc.com" })
      {
          await page.GotoAsync(currentUrl);
          var element = await page.WaitForSelectorAsync("img");
          Console.WriteLine($"Loaded image: {await element.GetAttributeAsync("src")}");
      }

      await browser.CloseAsync();
  }
}
```

**Arguments**
- `selector` string
  
  A selector to query for.
- `options` `PageWaitForSelectorOptions?` *(optional)*
  - `State` `enum WaitForSelectorState { Attached, Detached, Visible, Hidden }?` *(optional)*
    
    Defaults to `'visible'`. Can be either:
    * `'attached'` - wait for element to be present in DOM.
    * `'detached'` - wait for element to not be present in DOM.
    * `'visible'` - wait for element to have non-empty bounding box and no `visibility:hidden`. Note that element without any content or with `display:none` has an empty bounding box and is not considered visible.
    * `'hidden'` - wait for element to be either detached from DOM, or have an empty bounding box or `visibility:hidden`. This is opposite to the `'visible'` option.
  - `Strict` bool? *(optional)* 
    
    When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
  - `Timeout` float? *(optional)*
    
    Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [BrowserContext.SetDefaultTimeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [Page.SetDefaultTimeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- ElementHandle?

---

### WaitForTimeoutAsync {/* #page-wait-for-timeout */}



:::warningDiscouraged

Never wait for timeout in production. Tests that wait for time are inherently flaky. Use Locator actions and web assertions that wait automatically.

:::


Waits for the given [timeout](/api/class-page.mdx#page-wait-for-timeout-option-timeout) in milliseconds.

Note that `page.waitForTimeout()` should only be used for debugging. Tests using the timer in production are going to be flaky. Use signals such as network events, selectors becoming visible and others instead.

**Usage**

```csharp
// Wait for 1 second
await page.WaitForTimeoutAsync(1000);
```

**Arguments**
- `timeout` float
  
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
CDPSessionEvent: /api/class-cdpsessionevent.mdx "CDPSessionEvent"
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
Request: /api/class-request.mdx "Request"
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

bool: https://docs.microsoft.com/en-us/dotnet/api/system.boolean "bool"
Date: https://learn.microsoft.com/en-us/dotnet/api/system.datetime "DateTime"
double: https://docs.microsoft.com/en-us/dotnet/api/system.double "double"
byte: https://docs.microsoft.com/en-us/dotnet/api/system.byte "byte"
int: https://docs.microsoft.com/en-us/dotnet/api/system.int32 "int"
long: https://docs.microsoft.com/en-us/dotnet/api/system.int64 "long"
void: https://docs.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/void "void"
string: https://docs.microsoft.com/en-us/dotnet/api/system.string "string"
URL: https://nodejs.org/api/url.html "URL"
Regex: https://docs.microsoft.com/en-us/dotnet/api/system.text.regularexpressions.regex "Regex"

Action: https://docs.microsoft.com/en-us/dotnet/api/system.action-1 "Action"
Func: https://docs.microsoft.com/en-us/dotnet/api/system.func-2 "Func"
IEnumerable: https://docs.microsoft.com/en-us/dotnet/api/system.collections.ienumerable "IEnumerable"
IReadOnlyList: https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.ireadonlylist-1?view=net-9.0 "IReadOnlyList"
IDictionary: https://docs.microsoft.com/en-us/dotnet/api/system.collections.idictionary "IDictionary"
Task: https://docs.microsoft.com/en-us/dotnet/api/system.threading.tasks.task?view=net-5.0 "Task"
IReadOnlyDictionary: https://docs.microsoft.com/en-us/dotnet/api/system.collections.generic.ireadonlydictionary-2 "IReadOnlyDictionary"
JsonElement: https://docs.microsoft.com/en-us/dotnet/api/system.text.json.jsonelement "JsonElement"

all available image tags: https://mcr.microsoft.com/en-us/product/playwright/dotnet/about "all available image tags"
Microsoft Artifact Registry: https://mcr.microsoft.com/en-us/product/playwright/dotnet/about "Microsoft Artifact Registry"
Dockerfile.noble: https://github.com/microsoft/playwright-dotnet/blob/main/utils/docker/Dockerfile.noble "Dockerfile.noble"
