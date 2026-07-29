# Page

> **Source:** [playwright.dev/python/docs/api/class-page](https://playwright.dev/python/docs/api/class-page)

---

Page provides methods to interact with a single tab in a Browser, or an [extension background page](https://developer.chrome.com/extensions/background_pages) in Chromium. One Browser instance might have multiple Page instances.

This example creates a page, navigates it to a URL, and then saves a screenshot:

**sync**

```py
from playwright.sync_api import sync_playwright, Playwright

def run(playwright: Playwright):
    webkit = playwright.webkit
    browser = webkit.launch()
    context = browser.new_context()
    page = context.new_page()
    page.goto("https://example.com")
    page.screenshot(path="screenshot.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
```

**async**

```py
import asyncio
from playwright.async_api import async_playwright, Playwright

async def run(playwright: Playwright):
    webkit = playwright.webkit
    browser = await webkit.launch()
    context = await browser.new_context()
    page = await context.new_page()
    await page.goto("https://example.com")
    await page.screenshot(path="screenshot.png")
    await browser.close()

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())
```

The Page class emits various events (described below) which can be handled using any of Node's native [`EventEmitter`](https://nodejs.org/api/events.html#events_class_eventemitter) methods, such as `on`, `once` or `removeListener`.

This example logs a message for a single page `load` event:

```py
page.once("load", lambda: print("page loaded!"))
```

To unsubscribe from events use the `removeListener` method:

```py
def log_request(intercepted_request):
    print("a request was made:", intercepted_request.url)
page.on("request", log_request)
# sometime later...
page.remove_listener("request", log_request)
```


---

## Methods

### add_init_script {/* #page-add-init-script */}



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

**sync**

```py
# in your playwright script, assuming the preload.js file is in same directory
page.add_init_script(path="./preload.js")
```

**async**

```py
# in your playwright script, assuming the preload.js file is in same directory
await page.add_init_script(path="./preload.js")
```

:::note

The order of evaluation of multiple scripts installed via [browser_context.add_init_script()](/api/class-browsercontext.mdx#browser-context-add-init-script) and [page.add_init_script()](/api/class-page.mdx#page-add-init-script) is not defined.
:::

**Arguments**
- `path` Union\[str, pathlib.Path\] *(optional)*
  
  Path to the JavaScript file. If `path` is a relative path, then it is resolved relative to the current working directory. Optional.
- `script` str *(optional)*
  
  Script to be evaluated in all pages in the browser context. Optional.

**Returns**
- Disposable

---

### add_locator_handler {/* #page-add-locator-handler */}



When testing a web page, sometimes unexpected overlays like a "Sign up" dialog appear and block actions you want to automate, e.g. clicking a button. These overlays don't always show up in the same way or at the same time, making them tricky to handle in automated tests.

This method lets you set up a special function, called a handler, that activates when it detects that overlay is visible. The handler's job is to remove the overlay, allowing your test to continue as if the overlay wasn't there.

Things to keep in mind:
* When an overlay is shown predictably, we recommend explicitly waiting for it in your test and dismissing it as a part of your normal test flow, instead of using [page.add_locator_handler()](/api/class-page.mdx#page-add-locator-handler).
* Playwright checks for the overlay every time before executing or retrying an action that requires an [actionability check](../actionability.mdx), or before performing an auto-waiting assertion check. When overlay is visible, Playwright calls the handler first, and then proceeds with the action/assertion. Note that the handler is only called when you perform an action/assertion - if the overlay becomes visible but you don't perform any actions, the handler will not be triggered.
* After executing the handler, Playwright will ensure that overlay that triggered the handler is not visible anymore. You can opt-out of this behavior with [no_wait_after](/api/class-page.mdx#page-add-locator-handler-option-no-wait-after).
* The execution time of the handler counts towards the timeout of the action/assertion that executed the handler. If your handler takes too long, it might cause timeouts.
* You can register multiple handlers. However, only a single handler will be running at a time. Make sure the actions within a handler don't depend on another handler.

:::warning

Running the handler will alter your page state mid-test. For example it will change the currently focused element and move the mouse. Make sure that actions that run after the handler are self-contained and do not rely on the focus and mouse state being unchanged.

For example, consider a test that calls [locator.focus()](/api/class-locator.mdx#locator-focus) followed by [keyboard.press()](/api/class-keyboard.mdx#keyboard-press). If your handler clicks a button between these two actions, the focused element most likely will be wrong, and key press will happen on the unexpected element. Use [locator.press()](/api/class-locator.mdx#locator-press) instead to avoid this problem.

Another example is a series of mouse actions, where [mouse.move()](/api/class-mouse.mdx#mouse-move) is followed by [mouse.down()](/api/class-mouse.mdx#mouse-down). Again, when the handler runs between these two actions, the mouse position will be wrong during the mouse down. Prefer self-contained actions like [locator.click()](/api/class-locator.mdx#locator-click) that do not rely on the state being unchanged by a handler.
:::

**Usage**

An example that closes a "Sign up to the newsletter" dialog when it appears:

**sync**

```py
# Setup the handler.
def handler():
  page.get_by_role("button", name="No thanks").click()
page.add_locator_handler(page.get_by_text("Sign up to the newsletter"), handler)

# Write the test as usual.
page.goto("https://example.com")
page.get_by_role("button", name="Start here").click()
```

**async**

```py
# Setup the handler.
async def handler():
  await page.get_by_role("button", name="No thanks").click()
await page.add_locator_handler(page.get_by_text("Sign up to the newsletter"), handler)

# Write the test as usual.
await page.goto("https://example.com")
await page.get_by_role("button", name="Start here").click()
```

An example that skips the "Confirm your security details" page when it is shown:

**sync**

```py
# Setup the handler.
def handler():
  page.get_by_role("button", name="Remind me later").click()
page.add_locator_handler(page.get_by_text("Confirm your security details"), handler)

# Write the test as usual.
page.goto("https://example.com")
page.get_by_role("button", name="Start here").click()
```

**async**

```py
# Setup the handler.
async def handler():
  await page.get_by_role("button", name="Remind me later").click()
await page.add_locator_handler(page.get_by_text("Confirm your security details"), handler)

# Write the test as usual.
await page.goto("https://example.com")
await page.get_by_role("button", name="Start here").click()
```

An example with a custom callback on every actionability check. It uses a `<body>` locator that is always visible, so the handler is called before every actionability check. It is important to specify [no_wait_after](/api/class-page.mdx#page-add-locator-handler-option-no-wait-after), because the handler does not hide the `<body>` element.

**sync**

```py
# Setup the handler.
def handler():
  page.evaluate("window.removeObstructionsForTestIfNeeded()")
page.add_locator_handler(page.locator("body"), handler, no_wait_after=True)

# Write the test as usual.
page.goto("https://example.com")
page.get_by_role("button", name="Start here").click()
```

**async**

```py
# Setup the handler.
async def handler():
  await page.evaluate("window.removeObstructionsForTestIfNeeded()")
await page.add_locator_handler(page.locator("body"), handler, no_wait_after=True)

# Write the test as usual.
await page.goto("https://example.com")
await page.get_by_role("button", name="Start here").click()
```

Handler takes the original locator as an argument. You can also automatically remove the handler after a number of invocations by setting [times](/api/class-page.mdx#page-add-locator-handler-option-times):

**sync**

```py
def handler(locator):
  locator.click()
page.add_locator_handler(page.get_by_label("Close"), handler, times=1)
```

**async**

```py
async def handler(locator):
  await locator.click()
await page.add_locator_handler(page.get_by_label("Close"), handler, times=1)
```

**Arguments**
- `locator` Locator
  
  Locator that triggers the handler.
- `handler` Callable\[Locator\]:Promise\[Any\]
  
  Function that should be run once [locator](/api/class-page.mdx#page-add-locator-handler-option-locator) appears. This function should get rid of the element that blocks actions like click.
- `no_wait_after` bool *(optional)* 
  
  By default, after calling the handler Playwright will wait until the overlay becomes hidden, and only then Playwright will continue with the action/assertion that triggered the handler. This option allows to opt-out of this behavior, so that overlay can stay visible after the handler has run.
- `times` int *(optional)* 
  
  Specifies the maximum number of times this handler should be called. Unlimited by default.

**Returns**
- NoneType

---

### add_script_tag {/* #page-add-script-tag */}



Adds a `<script>` tag into the page with the desired url or content. Returns the added tag when the script's onload fires or when the script content was injected into frame.

**Usage**

```python
page.add_script_tag()
page.add_script_tag(**kwargs)
```

**Arguments**
- `content` str *(optional)*
  
  Raw JavaScript content to be injected into frame.
- `path` Union\[str, pathlib.Path\] *(optional)*
  
  Path to the JavaScript file to be injected into frame. If `path` is a relative path, then it is resolved relative to the current working directory.
- `type` str *(optional)*
  
  Script type. Use 'module' in order to load a JavaScript ES6 module. See [script](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script) for more details.
- `url` str *(optional)*
  
  URL of a script to be added.

**Returns**
- ElementHandle

---

### add_style_tag {/* #page-add-style-tag */}



Adds a `<link rel="stylesheet">` tag into the page with the desired url or a `<style type="text/css">` tag with the content. Returns the added tag when the stylesheet's onload fires or when the CSS content was injected into frame.

**Usage**

```python
page.add_style_tag()
page.add_style_tag(**kwargs)
```

**Arguments**
- `content` str *(optional)*
  
  Raw CSS content to be injected into frame.
- `path` Union\[str, pathlib.Path\] *(optional)*
  
  Path to the CSS file to be injected into frame. If `path` is a relative path, then it is resolved relative to the current working directory.
- `url` str *(optional)*
  
  URL of the `<link>` tag.

**Returns**
- ElementHandle

---

### aria_snapshot {/* #page-aria-snapshot */}



Captures the aria snapshot of the page. Read more about [aria snapshots](../aria-snapshots.mdx).

**Usage**

```python
page.aria_snapshot()
page.aria_snapshot(**kwargs)
```

**Arguments**
- `boxes` bool *(optional)* 
  
  When `true`, appends each element's bounding box as `box=x,y,width,height` to the snapshot. Coordinates are relative to the viewport, in CSS pixels, as returned by [`Element.getBoundingClientRect()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect). Defaults to `false`.
- `depth` int *(optional)*
  
  When specified, limits the depth of the snapshot.
- `mode` "ai" | "default" *(optional)*
  
  When set to `"ai"`, returns a snapshot optimized for AI consumption: including element references like `ref=e2` and snapshots of `<iframe>`s. Defaults to `"default"`.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- str

---

### bring_to_front {/* #page-bring-to-front */}



Brings page to front (activates tab).

**Usage**

```python
page.bring_to_front()
```

**Returns**
- NoneType

---

### cancel_pick_locator {/* #page-cancel-pick-locator */}



Cancels an ongoing [page.pick_locator()](/api/class-page.mdx#page-pick-locator) call by deactivating pick locator mode. If no pick locator mode is active, this method is a no-op.

**Usage**

```python
page.cancel_pick_locator()
```

**Returns**
- NoneType

---

### clear_console_messages {/* #page-clear-console-messages */}



Clears all stored console messages from this page. Subsequent calls to [page.console_messages()](/api/class-page.mdx#page-console-messages) will only return messages logged after the clear.

**Usage**

```python
page.clear_console_messages()
```

**Returns**
- NoneType

---

### clear_page_errors {/* #page-clear-page-errors */}



Clears all stored page errors from this page. Subsequent calls to [page.page_errors()](/api/class-page.mdx#page-page-errors) will only return errors thrown after the clear.

**Usage**

```python
page.clear_page_errors()
```

**Returns**
- NoneType

---

### close {/* #page-close */}



If [run_before_unload](/api/class-page.mdx#page-close-option-run-before-unload) is `false`, does not run any unload handlers and waits for the page to be closed. If [run_before_unload](/api/class-page.mdx#page-close-option-run-before-unload) is `true` the method will run unload handlers, but will **not** wait for the page to close.

By default, `page.close()` **does not** run `beforeunload` handlers.

:::note

if [run_before_unload](/api/class-page.mdx#page-close-option-run-before-unload) is passed as true, a `beforeunload` dialog might be summoned and should be handled manually via [page.on("dialog")](/api/class-page.mdx#page-event-dialog) event.
:::

**Usage**

```python
page.close()
page.close(**kwargs)
```

**Arguments**
- `reason` str *(optional)* 
  
  The reason to be reported to the operations interrupted by the page closure.
- `run_before_unload` bool *(optional)*
  
  Defaults to `false`. Whether to run the [before unload](https://developer.mozilla.org/en-US/docs/Web/Events/beforeunload) page handlers.

**Returns**
- NoneType

---

### console_messages {/* #page-console-messages */}



Returns up to (currently) 200 last console messages from this page. See [page.on("console")](/api/class-page.mdx#page-event-console) for more details.

**Usage**

```python
page.console_messages()
page.console_messages(**kwargs)
```

**Arguments**
- `filter` "all" | "since-navigation" *(optional)* 
  
  Controls which messages are returned:

**Returns**
- List\[ConsoleMessage\]

---

### content {/* #page-content */}



Gets the full HTML contents of the page, including the doctype.

**Usage**

```python
page.content()
```

**Returns**
- str

---

### drag_and_drop {/* #page-drag-and-drop */}



This method drags the source element to the target element. It will first move to the source element, perform a `mousedown`, then move to the target element and perform a `mouseup`.

**Usage**

**sync**

```py
page.drag_and_drop("#source", "#target")
# or specify exact positions relative to the top-left corners of the elements:
page.drag_and_drop(
  "#source",
  "#target",
  source_position={"x": 34, "y": 7},
  target_position={"x": 10, "y": 20}
)
```

**async**

```py
await page.drag_and_drop("#source", "#target")
# or specify exact positions relative to the top-left corners of the elements:
await page.drag_and_drop(
  "#source",
  "#target",
  source_position={"x": 34, "y": 7},
  target_position={"x": 10, "y": 20}
)
```

**Arguments**
- `source` str
  
  A selector to search for an element to drag. If there are multiple elements satisfying the selector, the first will be used.
- `target` str
  
  A selector to search for an element to drop onto. If there are multiple elements satisfying the selector, the first will be used.
- `force` bool *(optional)*
  
  Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
- `no_wait_after` bool *(optional)*
  
  :::warningDeprecated
  This option has no effect.
  :::
  
  
  This option has no effect.
- `scroll` "auto" | "none" *(optional)* 
  
  Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
- `source_position` Dict *(optional)* 
  - `x` float
    
    
  - `y` float
    
    
  Clicks on the source element at this point relative to the top-left corner of the element's padding box. If not specified, some visible point of the element is used.
- `steps` int *(optional)* 
  
  Defaults to 1. Sends `n` interpolated `mousemove` events to represent travel between the `mousedown` and `mouseup` of the drag. When set to 1, emits a single `mousemove` event at the destination location.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `target_position` Dict *(optional)* 
  - `x` float
    
    
  - `y` float
    
    
  Drops on the target element at this point relative to the top-left corner of the element's padding box. If not specified, some visible point of the element is used.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.
- `trial` bool *(optional)*
  
  When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it.

**Returns**
- NoneType

---

### emulate_media {/* #page-emulate-media */}



This method changes the `CSS media type` through the `media` argument, and/or the `'prefers-colors-scheme'` media feature, using the `colorScheme` argument.

**Usage**

**sync**

```py
page.evaluate("matchMedia('screen').matches")
# → True
page.evaluate("matchMedia('print').matches")
# → False

page.emulate_media(media="print")
page.evaluate("matchMedia('screen').matches")
# → False
page.evaluate("matchMedia('print').matches")
# → True

page.emulate_media()
page.evaluate("matchMedia('screen').matches")
# → True
page.evaluate("matchMedia('print').matches")
# → False
```

**async**

```py
await page.evaluate("matchMedia('screen').matches")
# → True
await page.evaluate("matchMedia('print').matches")
# → False

await page.emulate_media(media="print")
await page.evaluate("matchMedia('screen').matches")
# → False
await page.evaluate("matchMedia('print').matches")
# → True

await page.emulate_media()
await page.evaluate("matchMedia('screen').matches")
# → True
await page.evaluate("matchMedia('print').matches")
# → False
```

**sync**

```py
page.emulate_media(color_scheme="dark")
page.evaluate("matchMedia('(prefers-color-scheme: dark)').matches")
# → True
page.evaluate("matchMedia('(prefers-color-scheme: light)').matches")
# → False
```

**async**

```py
await page.emulate_media(color_scheme="dark")
await page.evaluate("matchMedia('(prefers-color-scheme: dark)').matches")
# → True
await page.evaluate("matchMedia('(prefers-color-scheme: light)').matches")
# → False
```

**Arguments**
- `color_scheme` "light" | "dark" | "no-preference" | "null" *(optional)* 
  
  Emulates [prefers-colors-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme) media feature, supported values are `'light'` and `'dark'`. Passing `'Null'` disables color scheme emulation. `'no-preference'` is deprecated.
- `contrast` "no-preference" | "more" | "null" *(optional)* 
- `forced_colors` "active" | "none" | "null" *(optional)* 
- `media` "screen" | "print" | "null" *(optional)* 
  
  Changes the CSS media type of the page. The only allowed values are `'Screen'`, `'Print'` and `'Null'`. Passing `'Null'` disables CSS media emulation.
- `reduced_motion` "reduce" | "no-preference" | "null" *(optional)* 
  
  Emulates `'prefers-reduced-motion'` media feature, supported values are `'reduce'`, `'no-preference'`. Passing `null` disables reduced motion emulation.

**Returns**
- NoneType

---

### evaluate {/* #page-evaluate */}



Returns the value of the [expression](/api/class-page.mdx#page-evaluate-option-expression) invocation.

If the function passed to the [page.evaluate()](/api/class-page.mdx#page-evaluate) returns a Promise, then [page.evaluate()](/api/class-page.mdx#page-evaluate) would wait for the promise to resolve and return its value.

If the function passed to the [page.evaluate()](/api/class-page.mdx#page-evaluate) returns a non-Serializable value, then [page.evaluate()](/api/class-page.mdx#page-evaluate) resolves to `undefined`. Playwright also supports transferring some additional values that are not serializable by `JSON`: `-0`, `NaN`, `Infinity`, `-Infinity`.

**Usage**

Passing argument to [expression](/api/class-page.mdx#page-evaluate-option-expression):

**sync**

```py
result = page.evaluate("(x, y) => Promise.resolve(x * y)", 7, 8)
print(result) # prints "56"
```

**async**

```py
result = await page.evaluate("(x, y) => Promise.resolve(x * y)", 7, 8)
print(result) # prints "56"
```

A string can also be passed in instead of a function:

**sync**

```py
print(page.evaluate("1 + 2")) # prints "3"
x = 10
print(page.evaluate(f"1 + {x}")) # prints "11"
```

**async**

```py
print(await page.evaluate("1 + 2")) # prints "3"
x = 10
print(await page.evaluate(f"1 + {x}")) # prints "11"
```

ElementHandle instances can be passed as an argument to the [page.evaluate()](/api/class-page.mdx#page-evaluate):

**sync**

```py
body_handle = page.evaluate_handle("document.body")
html = page.evaluate("(body, suffix) => body.innerHTML + suffix", body_handle, "hello")
body_handle.dispose()
```

**async**

```py
body_handle = await page.evaluate_handle("document.body")
html = await page.evaluate("(body, suffix) => body.innerHTML + suffix", body_handle, "hello")
await body_handle.dispose()
```

**Arguments**
- `expression` str
  
  JavaScript expression to be evaluated in the browser context. If the expression evaluates to a function, the function is automatically invoked.
- `arg` EvaluationArgument *(optional)*
  
  Optional argument to pass to [expression](/api/class-page.mdx#page-evaluate-option-expression).

**Returns**
- Dict

---

### evaluate_handle {/* #page-evaluate-handle */}



Returns the value of the [expression](/api/class-page.mdx#page-evaluate-handle-option-expression) invocation as a JSHandle.

The only difference between [page.evaluate()](/api/class-page.mdx#page-evaluate) and [page.evaluate_handle()](/api/class-page.mdx#page-evaluate-handle) is that [page.evaluate_handle()](/api/class-page.mdx#page-evaluate-handle) returns JSHandle.

If the function passed to the [page.evaluate_handle()](/api/class-page.mdx#page-evaluate-handle) returns a Promise, then [page.evaluate_handle()](/api/class-page.mdx#page-evaluate-handle) would wait for the promise to resolve and return its value.

**Usage**

**sync**

```py
a_window_handle = page.evaluate_handle("Promise.resolve(window)")
a_window_handle # handle for the window object.
```

**async**

```py
a_window_handle = await page.evaluate_handle("Promise.resolve(window)")
a_window_handle # handle for the window object.
```

A string can also be passed in instead of a function:

**sync**

```py
a_handle = page.evaluate_handle("document") # handle for the "document"
```

**async**

```py
a_handle = await page.evaluate_handle("document") # handle for the "document"
```

JSHandle instances can be passed as an argument to the [page.evaluate_handle()](/api/class-page.mdx#page-evaluate-handle):

**sync**

```py
a_handle = page.evaluate_handle("document.body")
result_handle = page.evaluate_handle("body => body.innerHTML", a_handle)
print(result_handle.json_value())
result_handle.dispose()
```

**async**

```py
a_handle = await page.evaluate_handle("document.body")
result_handle = await page.evaluate_handle("body => body.innerHTML", a_handle)
print(await result_handle.json_value())
await result_handle.dispose()
```

**Arguments**
- `expression` str
  
  JavaScript expression to be evaluated in the browser context. If the expression evaluates to a function, the function is automatically invoked.
- `arg` EvaluationArgument *(optional)*
  
  Optional argument to pass to [expression](/api/class-page.mdx#page-evaluate-handle-option-expression).

**Returns**
- JSHandle

---

### expect_console_message {/* #page-wait-for-console-message */}



Performs action and waits for a ConsoleMessage to be logged by in the page. If predicate is provided, it passes ConsoleMessage value into the `predicate` function and waits for `predicate(message)` to return a truthy value. Will throw an error if the page is closed before the [page.on("console")](/api/class-page.mdx#page-event-console) event is fired.

**Usage**

```python
page.expect_console_message()
page.expect_console_message(**kwargs)
```

**Arguments**
- `predicate` Callable\[ConsoleMessage\]:bool *(optional)*
  
  Receives the ConsoleMessage object and resolves to truthy value when the waiting should resolve.
- `timeout` float *(optional)*
  
  Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- EventContextManager\[ConsoleMessage\]

---

### expect_download {/* #page-wait-for-download */}



Performs action and waits for a new Download. If predicate is provided, it passes Download value into the `predicate` function and waits for `predicate(download)` to return a truthy value. Will throw an error if the page is closed before the download event is fired.

**Usage**

```python
page.expect_download()
page.expect_download(**kwargs)
```

**Arguments**
- `predicate` Callable\[Download\]:bool *(optional)*
  
  Receives the Download object and resolves to truthy value when the waiting should resolve.
- `timeout` float *(optional)*
  
  Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- EventContextManager\[Download\]

---

### expect_event {/* #page-wait-for-event */}



Waits for event to fire and passes its value into the predicate function. Returns when the predicate returns truthy value. Will throw an error if the page is closed before the event is fired. Returns the event data value.

**Usage**

**sync**

```py
with page.expect_event("framenavigated") as event_info:
    page.get_by_role("button")
frame = event_info.value
```

**async**

```py
async with page.expect_event("framenavigated") as event_info:
    await page.get_by_role("button")
frame = await event_info.value
```

**Arguments**
- `event` str
  
  Event name, same one typically passed into `*.on(event)`.
- `predicate` Callable *(optional)*
  
  Receives the event data and resolves to truthy value when the waiting should resolve.
- `timeout` float *(optional)*
  
  Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- EventContextManager

---

### expect_file_chooser {/* #page-wait-for-file-chooser */}



Performs action and waits for a new FileChooser to be created. If predicate is provided, it passes FileChooser value into the `predicate` function and waits for `predicate(fileChooser)` to return a truthy value. Will throw an error if the page is closed before the file chooser is opened.

**Usage**

```python
page.expect_file_chooser()
page.expect_file_chooser(**kwargs)
```

**Arguments**
- `predicate` Callable\[FileChooser\]:bool *(optional)*
  
  Receives the FileChooser object and resolves to truthy value when the waiting should resolve.
- `timeout` float *(optional)*
  
  Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- EventContextManager\[FileChooser\]

---

### expect_popup {/* #page-wait-for-popup */}



Performs action and waits for a popup Page. If predicate is provided, it passes Popup value into the `predicate` function and waits for `predicate(page)` to return a truthy value. Will throw an error if the page is closed before the popup event is fired.

**Usage**

```python
page.expect_popup()
page.expect_popup(**kwargs)
```

**Arguments**
- `predicate` Callable\[Page\]:bool *(optional)*
  
  Receives the Page object and resolves to truthy value when the waiting should resolve.
- `timeout` float *(optional)*
  
  Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- EventContextManager\[Page\]

---

### expect_request {/* #page-wait-for-request */}



Waits for the matching request and returns it. See [waiting for event](../events.mdx#waiting-for-event) for more details about events.

**Usage**

**sync**

```py
with page.expect_request("http://example.com/resource") as first:
    page.get_by_text("trigger request").click()
first_request = first.value

# or with a lambda
with page.expect_request(lambda request: request.url == "http://example.com" and request.method == "get") as second:
    page.get_by_text("trigger request").click()
second_request = second.value
```

**async**

```py
async with page.expect_request("http://example.com/resource") as first:
    await page.get_by_text("trigger request").click()
first_request = await first.value

# or with a lambda
async with page.expect_request(lambda request: request.url == "http://example.com" and request.method == "get") as second:
    await page.get_by_text("trigger request").click()
second_request = await second.value
```

**Arguments**
- `url_or_predicate` str | Pattern | Callable\[Request\]:bool
  
  Request URL string, regex or predicate receiving Request object. When a [base_url](/api/class-browser.mdx#browser-new-context-option-base-url) via the context options was provided and the passed URL is a path, it gets merged via the [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor.
- `timeout` float *(optional)*
  
  Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be changed by using the [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) method.

**Returns**
- EventContextManager\[Request\]

---

### expect_request_finished {/* #page-wait-for-request-finished */}



Performs action and waits for a Request to finish loading. If predicate is provided, it passes Request value into the `predicate` function and waits for `predicate(request)` to return a truthy value. Will throw an error if the page is closed before the [page.on("requestfinished")](/api/class-page.mdx#page-event-request-finished) event is fired.

**Usage**

```python
page.expect_request_finished()
page.expect_request_finished(**kwargs)
```

**Arguments**
- `predicate` Callable\[Request\]:bool *(optional)*
  
  Receives the Request object and resolves to truthy value when the waiting should resolve.
- `timeout` float *(optional)*
  
  Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- EventContextManager\[Request\]

---

### expect_response {/* #page-wait-for-response */}



Returns the matched response. See [waiting for event](../events.mdx#waiting-for-event) for more details about events.

**Usage**

**sync**

```py
with page.expect_response("https://example.com/resource") as response_info:
    page.get_by_text("trigger response").click()
response = response_info.value
return response.ok

# or with a lambda
with page.expect_response(lambda response: response.url == "https://example.com" and response.status == 200 and response.request.method == "get") as response_info:
    page.get_by_text("trigger response").click()
response = response_info.value
return response.ok
```

**async**

```py
async with page.expect_response("https://example.com/resource") as response_info:
    await page.get_by_text("trigger response").click()
response = await response_info.value
return response.ok

# or with a lambda
async with page.expect_response(lambda response: response.url == "https://example.com" and response.status == 200 and response.request.method == "get") as response_info:
    await page.get_by_text("trigger response").click()
response = await response_info.value
return response.ok
```

**Arguments**
- `url_or_predicate` str | Pattern | Callable\[Response\]:bool
  
  Request URL string, regex or predicate receiving Response object. When a [base_url](/api/class-browser.mdx#browser-new-context-option-base-url) via the context options was provided and the passed URL is a path, it gets merged via the [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor.
- `timeout` float *(optional)*
  
  Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- EventContextManager\[Response\]

---

### expect_websocket {/* #page-wait-for-web-socket */}



Performs action and waits for a new WebSocket. If predicate is provided, it passes WebSocket value into the `predicate` function and waits for `predicate(webSocket)` to return a truthy value. Will throw an error if the page is closed before the WebSocket event is fired.

**Usage**

```python
page.expect_websocket()
page.expect_websocket(**kwargs)
```

**Arguments**
- `predicate` Callable\[WebSocket\]:bool *(optional)*
  
  Receives the WebSocket object and resolves to truthy value when the waiting should resolve.
- `timeout` float *(optional)*
  
  Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- EventContextManager\[WebSocket\]

---

### expect_worker {/* #page-wait-for-worker */}



Performs action and waits for a new Worker. If predicate is provided, it passes Worker value into the `predicate` function and waits for `predicate(worker)` to return a truthy value. Will throw an error if the page is closed before the worker event is fired.

**Usage**

```python
page.expect_worker()
page.expect_worker(**kwargs)
```

**Arguments**
- `predicate` Callable\[Worker\]:bool *(optional)*
  
  Receives the Worker object and resolves to truthy value when the waiting should resolve.
- `timeout` float *(optional)*
  
  Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- EventContextManager\[Worker\]

---

### expose_binding {/* #page-expose-binding */}



The method adds a function called [name](/api/class-page.mdx#page-expose-binding-option-name) on the `window` object of every frame in this page. When called, the function executes [callback](/api/class-page.mdx#page-expose-binding-option-callback) and returns a Promise which resolves to the return value of [callback](/api/class-page.mdx#page-expose-binding-option-callback). If the [callback](/api/class-page.mdx#page-expose-binding-option-callback) returns a Promise, it will be awaited.

The first argument of the [callback](/api/class-page.mdx#page-expose-binding-option-callback) function contains information about the caller: `{ browserContext: BrowserContext, page: Page, frame: Frame }`.

See [browser_context.expose_binding()](/api/class-browsercontext.mdx#browser-context-expose-binding) for the context-wide version.

:::note

Functions installed via [page.expose_binding()](/api/class-page.mdx#page-expose-binding) survive navigations.
:::

**Usage**

An example of exposing page URL to all frames in a page:

**sync**

```py
from playwright.sync_api import sync_playwright, Playwright

def run(playwright: Playwright):
    webkit = playwright.webkit
    browser = webkit.launch(headless=False)
    context = browser.new_context()
    page = context.new_page()
    page.expose_binding("pageURL", lambda source: source"page".url)
    page.set_content("""
    <script>
      async function onClick() {
        document.querySelector('div').textContent = await window.pageURL();
      }
    </script>
    <button onclick="onClick()">Click me</button>
    <div></div>
    """)
    page.click("button")

with sync_playwright() as playwright:
    run(playwright)
```

**async**

```py
import asyncio
from playwright.async_api import async_playwright, Playwright

async def run(playwright: Playwright):
    webkit = playwright.webkit
    browser = await webkit.launch(headless=False)
    context = await browser.new_context()
    page = await context.new_page()
    await page.expose_binding("pageURL", lambda source: source"page".url)
    await page.set_content("""
    <script>
      async function onClick() {
        document.querySelector('div').textContent = await window.pageURL();
      }
    </script>
    <button onclick="onClick()">Click me</button>
    <div></div>
    """)
    await page.click("button")

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())
```

**Arguments**
- `name` str
  
  Name of the function on the window object.
- `callback` Callable
  
  Callback function that will be called in the Playwright's context.

**Returns**
- Disposable

---

### expose_function {/* #page-expose-function */}



The method adds a function called [name](/api/class-page.mdx#page-expose-function-option-name) on the `window` object of every frame in the page. When called, the function executes [callback](/api/class-page.mdx#page-expose-function-option-callback) and returns a Promise which resolves to the return value of [callback](/api/class-page.mdx#page-expose-function-option-callback).

If the [callback](/api/class-page.mdx#page-expose-function-option-callback) returns a Promise, it will be awaited.

See [browser_context.expose_function()](/api/class-browsercontext.mdx#browser-context-expose-function) for context-wide exposed function.

:::note

Functions installed via [page.expose_function()](/api/class-page.mdx#page-expose-function) survive navigations.
:::

**Usage**

An example of adding a `sha256` function to the page:

**sync**

```py
import hashlib
from playwright.sync_api import sync_playwright, Playwright

def sha256(text):
    m = hashlib.sha256()
    m.update(bytes(text, "utf8"))
    return m.hexdigest()


def run(playwright: Playwright):
    webkit = playwright.webkit
    browser = webkit.launch(headless=False)
    page = browser.new_page()
    page.expose_function("sha256", sha256)
    page.set_content("""
        <script>
          async function onClick() {
            document.querySelector('div').textContent = await window.sha256('PLAYWRIGHT');
          }
        </script>
        <button onclick="onClick()">Click me</button>
        <div></div>
    """)
    page.click("button")

with sync_playwright() as playwright:
    run(playwright)
```

**async**

```py
import asyncio
import hashlib
from playwright.async_api import async_playwright, Playwright

def sha256(text):
    m = hashlib.sha256()
    m.update(bytes(text, "utf8"))
    return m.hexdigest()


async def run(playwright: Playwright):
    webkit = playwright.webkit
    browser = await webkit.launch(headless=False)
    page = await browser.new_page()
    await page.expose_function("sha256", sha256)
    await page.set_content("""
        <script>
          async function onClick() {
            document.querySelector('div').textContent = await window.sha256('PLAYWRIGHT');
          }
        </script>
        <button onclick="onClick()">Click me</button>
        <div></div>
    """)
    await page.click("button")

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())
```

**Arguments**
- `name` str
  
  Name of the function on the window object
- `callback` Callable
  
  Callback function which will be called in Playwright's context.

**Returns**
- Disposable

---

### frame {/* #page-frame */}



Returns frame matching the specified criteria. Either `name` or `url` must be specified.

**Usage**

```py
frame = page.frame(name="frame-name")
```

```py
frame = page.frame(url=r".*domain.*")
```

**Arguments**
- `name` str *(optional)*
  
  Frame name specified in the `iframe`'s `name` attribute. Optional.
- `url` str | Pattern | Callable\[URL\]:bool *(optional)*
  
  A glob pattern, regex pattern or predicate receiving frame's `url` as a URL object. Optional.

**Returns**
- NoneType | Frame

---

### frame_locator {/* #page-frame-locator */}



When working with iframes, you can create a frame locator that will enter the iframe and allow selecting elements in that iframe.

**Usage**

Following snippet locates element with text "Submit" in the iframe with id `my-frame`, like `<iframe id="my-frame">`:

**sync**

```py
locator = page.frame_locator("#my-iframe").get_by_text("Submit")
locator.click()
```

**async**

```py
locator = page.frame_locator("#my-iframe").get_by_text("Submit")
await locator.click()
```

**Arguments**
- `selector` str
  
  A selector to use when resolving DOM element.

**Returns**
- FrameLocator

---

### get_by_alt_text {/* #page-get-by-alt-text */}



Allows locating elements by their alt text.

**Usage**

For example, this method will find the image by alt text "Playwright logo":

```html
<img alt='Playwright logo'>
```

**sync**

```py
page.get_by_alt_text("Playwright logo").click()
```

**async**

```py
await page.get_by_alt_text("Playwright logo").click()
```

**Arguments**
- `text` str | Pattern
  
  Text to locate the element for.
- `exact` bool *(optional)*
  
  Whether to find an exact match: case-sensitive and whole-string. Default to false. Ignored when locating by a regular expression. Note that exact match still trims whitespace.

**Returns**
- Locator

---

### get_by_label {/* #page-get-by-label */}



Allows locating input elements by the text of the associated `<label>` or `aria-labelledby` element, or by the `aria-label` attribute.

**Usage**

For example, this method will find inputs by label "Username" and "Password" in the following DOM:

```html
<input aria-label="Username">
<label for="password-input">Password:</label>
<input id="password-input">
```

**sync**

```py
page.get_by_label("Username").fill("john")
page.get_by_label("Password").fill("secret")
```

**async**

```py
await page.get_by_label("Username").fill("john")
await page.get_by_label("Password").fill("secret")
```

**Arguments**
- `text` str | Pattern
  
  Text to locate the element for.
- `exact` bool *(optional)*
  
  Whether to find an exact match: case-sensitive and whole-string. Default to false. Ignored when locating by a regular expression. Note that exact match still trims whitespace.

**Returns**
- Locator

---

### get_by_placeholder {/* #page-get-by-placeholder */}



Allows locating input elements by the placeholder text.

**Usage**

For example, consider the following DOM structure.

```html
<input type="email" placeholder="name@example.com" />
```

You can fill the input after locating it by the placeholder text:

**sync**

```py
page.get_by_placeholder("name@example.com").fill("playwright@microsoft.com")
```

**async**

```py
await page.get_by_placeholder("name@example.com").fill("playwright@microsoft.com")
```

**Arguments**
- `text` str | Pattern
  
  Text to locate the element for.
- `exact` bool *(optional)*
  
  Whether to find an exact match: case-sensitive and whole-string. Default to false. Ignored when locating by a regular expression. Note that exact match still trims whitespace.

**Returns**
- Locator

---

### get_by_role {/* #page-get-by-role */}



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

**sync**

```py
expect(page.get_by_role("heading", name="Sign up")).to_be_visible()

page.get_by_role("checkbox", name="Subscribe").check()

page.get_by_role("button", name=re.compile("submit", re.IGNORECASE)).click()
```

**async**

```py
await expect(page.get_by_role("heading", name="Sign up")).to_be_visible()

await page.get_by_role("checkbox", name="Subscribe").check()

await page.get_by_role("button", name=re.compile("submit", re.IGNORECASE)).click()
```

**Arguments**
- `role` "alert" | "alertdialog" | "application" | "article" | "banner" | "blockquote" | "button" | "caption" | "cell" | "checkbox" | "code" | "columnheader" | "combobox" | "complementary" | "contentinfo" | "definition" | "deletion" | "dialog" | "directory" | "document" | "emphasis" | "feed" | "figure" | "form" | "generic" | "grid" | "gridcell" | "group" | "heading" | "img" | "insertion" | "link" | "list" | "listbox" | "listitem" | "log" | "main" | "marquee" | "math" | "meter" | "menu" | "menubar" | "menuitem" | "menuitemcheckbox" | "menuitemradio" | "navigation" | "none" | "note" | "option" | "paragraph" | "presentation" | "progressbar" | "radio" | "radiogroup" | "region" | "row" | "rowgroup" | "rowheader" | "scrollbar" | "search" | "searchbox" | "separator" | "slider" | "spinbutton" | "status" | "strong" | "subscript" | "superscript" | "switch" | "tab" | "table" | "tablist" | "tabpanel" | "term" | "textbox" | "time" | "timer" | "toolbar" | "tooltip" | "tree" | "treegrid" | "treeitem"
  
  Required aria role.
- `checked` bool *(optional)*
  
  An attribute that is usually set by `aria-checked` or native `<input type=checkbox>` controls.
  
  Learn more about [`aria-checked`](https://www.w3.org/TR/wai-aria-1.2/#aria-checked).
- `description` str | Pattern *(optional)* 
  
  Option to match the [accessible description](https://w3c.github.io/accname/#dfn-accessible-description). By default, matching is case-insensitive and searches for a substring, use [exact](/api/class-page.mdx#page-get-by-role-option-exact) to control this behavior.
  
  Learn more about [accessible description](https://w3c.github.io/accname/#dfn-accessible-description).
- `disabled` bool *(optional)*
  
  An attribute that is usually set by `aria-disabled` or `disabled`.
  
  :::note
  
  Unlike most other attributes, `disabled` is inherited through the DOM hierarchy. Learn more about [`aria-disabled`](https://www.w3.org/TR/wai-aria-1.2/#aria-disabled).
  :::
  
- `exact` bool *(optional)* 
  
  Whether [name](/api/class-page.mdx#page-get-by-role-option-name) and [description](/api/class-page.mdx#page-get-by-role-option-description) are matched exactly: case-sensitive and whole-string. Defaults to false. Ignored when the value is a regular expression. Note that exact match still trims whitespace.
- `expanded` bool *(optional)*
  
  An attribute that is usually set by `aria-expanded`.
  
  Learn more about [`aria-expanded`](https://www.w3.org/TR/wai-aria-1.2/#aria-expanded).
- `include_hidden` bool *(optional)*
  
  Option that controls whether hidden elements are matched. By default, only non-hidden elements, as [defined by ARIA](https://www.w3.org/TR/wai-aria-1.2/#tree_exclusion), are matched by role selector.
  
  Learn more about [`aria-hidden`](https://www.w3.org/TR/wai-aria-1.2/#aria-hidden).
- `level` int *(optional)*
  
  A number attribute that is usually present for roles `heading`, `listitem`, `row`, `treeitem`, with default values for `<h1>-<h6>` elements.
  
  Learn more about [`aria-level`](https://www.w3.org/TR/wai-aria-1.2/#aria-level).
- `name` str | Pattern *(optional)*
  
  Option to match the [accessible name](https://w3c.github.io/accname/#dfn-accessible-name). By default, matching is case-insensitive and searches for a substring, use [exact](/api/class-page.mdx#page-get-by-role-option-exact) to control this behavior.
  
  Learn more about [accessible name](https://w3c.github.io/accname/#dfn-accessible-name).
- `pressed` bool *(optional)*
  
  An attribute that is usually set by `aria-pressed`.
  
  Learn more about [`aria-pressed`](https://www.w3.org/TR/wai-aria-1.2/#aria-pressed).
- `selected` bool *(optional)*
  
  An attribute that is usually set by `aria-selected`.
  
  Learn more about [`aria-selected`](https://www.w3.org/TR/wai-aria-1.2/#aria-selected).

**Returns**
- Locator

**Details**

Role selector **does not replace** accessibility audits and conformance tests, but rather gives early feedback about the ARIA guidelines.

Many html elements have an implicitly [defined role](https://w3c.github.io/html-aam/#html-element-role-mappings) that is recognized by the role selector. You can find all the [supported roles here](https://www.w3.org/TR/wai-aria-1.2/#role_definitions). ARIA guidelines **do not recommend** duplicating implicit roles and attributes by setting `role` and/or `aria-*` attributes to default values.

---

### get_by_test_id {/* #page-get-by-test-id */}



Locate element by the test id.

**Usage**

Consider the following DOM structure.

```html
<button data-testid="directions">Itinéraire</button>
```

You can locate the element by its test id:

**sync**

```py
page.get_by_test_id("directions").click()
```

**async**

```py
await page.get_by_test_id("directions").click()
```

**Arguments**
- `test_id` str | Pattern
  
  Id to locate the element by.

**Returns**
- Locator

**Details**

By default, the `data-testid` attribute is used as a test id. Use [selectors.set_test_id_attribute()](/api/class-selectors.mdx#selectors-set-test-id-attribute) to configure a different test id attribute if necessary.

---

### get_by_text {/* #page-get-by-text */}



Allows locating elements that contain given text.

See also [locator.filter()](/api/class-locator.mdx#locator-filter) that allows to match by another criteria, like an accessible role, and then filter by the text content.

**Usage**

Consider the following DOM structure:

```html
<div>Hello <span>world</span></div>
<div>Hello</div>
```

You can locate by text substring, exact string, or a regular expression:

**sync**

```py
# Matches <span>
page.get_by_text("world")

# Matches first <div>
page.get_by_text("Hello world")

# Matches second <div>
page.get_by_text("Hello", exact=True)

# Matches both <div>s
page.get_by_text(re.compile("Hello"))

# Matches second <div>
page.get_by_text(re.compile("^hello$", re.IGNORECASE))
```

**async**

```py
# Matches <span>
page.get_by_text("world")

# Matches first <div>
page.get_by_text("Hello world")

# Matches second <div>
page.get_by_text("Hello", exact=True)

# Matches both <div>s
page.get_by_text(re.compile("Hello"))

# Matches second <div>
page.get_by_text(re.compile("^hello$", re.IGNORECASE))
```

**Arguments**
- `text` str | Pattern
  
  Text to locate the element for.
- `exact` bool *(optional)*
  
  Whether to find an exact match: case-sensitive and whole-string. Default to false. Ignored when locating by a regular expression. Note that exact match still trims whitespace.

**Returns**
- Locator

**Details**

Matching by text always normalizes whitespace, even with exact match. For example, it turns multiple spaces into one, turns line breaks into spaces and ignores leading and trailing whitespace.

Input elements of the type `button` and `submit` are matched by their `value` instead of the text content. For example, locating by text `"Log in"` matches `<input type=button value="Log in">`.

---

### get_by_title {/* #page-get-by-title */}



Allows locating elements by their title attribute.

**Usage**

Consider the following DOM structure.

```html
<span title='Issues count'>25 issues</span>
```

You can check the issues count after locating it by the title text:

**sync**

```py
expect(page.get_by_title("Issues count")).to_have_text("25 issues")
```

**async**

```py
await expect(page.get_by_title("Issues count")).to_have_text("25 issues")
```

**Arguments**
- `text` str | Pattern
  
  Text to locate the element for.
- `exact` bool *(optional)*
  
  Whether to find an exact match: case-sensitive and whole-string. Default to false. Ignored when locating by a regular expression. Note that exact match still trims whitespace.

**Returns**
- Locator

---

### go_back {/* #page-go-back */}



Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. If cannot go back, returns `null`.

Navigate to the previous page in history.

:::warning

**Testing Back/Forward Cache (BFCache) is not supported.**  By default, Playwright disables the Back/Forward Cache across all browsers. Even if explicitly enabled, Playwright's internal state relies on network-level navigation events. Because BFCache restores unfreeze the DOM without firing these events, using `page.goBack()` or `page.goForward()` to trigger a BFCache restore will result in timeouts and a desynchronized `Page` state.
:::

**Usage**

```python
page.go_back()
page.go_back(**kwargs)
```

**Arguments**
- `timeout` float *(optional)*
  
  Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_navigation_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [page.set_default_navigation_timeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.
- `wait_until` "load" | "domcontentloaded" | "networkidle" | "commit" *(optional)*
  
  When to consider operation succeeded, defaults to `load`. Events can be either:
  * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
  * `'load'` - consider operation to be finished when the `load` event is fired.
  * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
  * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- NoneType | Response

---

### go_forward {/* #page-go-forward */}



Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. If cannot go forward, returns `null`.

Navigate to the next page in history.

:::warning

**Testing Back/Forward Cache (BFCache) is not supported.**  By default, Playwright disables the Back/Forward Cache across all browsers. Even if explicitly enabled, Playwright's internal state relies on network-level navigation events. Because BFCache restores unfreeze the DOM without firing these events, using `page.goBack()` or `page.goForward()` to trigger a BFCache restore will result in timeouts and a desynchronized `Page` state.
:::

**Usage**

```python
page.go_forward()
page.go_forward(**kwargs)
```

**Arguments**
- `timeout` float *(optional)*
  
  Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_navigation_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [page.set_default_navigation_timeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.
- `wait_until` "load" | "domcontentloaded" | "networkidle" | "commit" *(optional)*
  
  When to consider operation succeeded, defaults to `load`. Events can be either:
  * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
  * `'load'` - consider operation to be finished when the `load` event is fired.
  * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
  * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- NoneType | Response

---

### goto {/* #page-goto */}



Returns the main resource response. In case of multiple redirects, the navigation will resolve with the first non-redirect response.

The method will throw an error if:
* there's an SSL error (e.g. in case of self-signed certificates).
* target URL is invalid.
* the [timeout](/api/class-page.mdx#page-goto-option-timeout) is exceeded during navigation.
* the remote server does not respond or is unreachable.
* the main resource failed to load.

The method will not throw an error when any valid HTTP status code is returned by the remote server, including 404 "Not Found" and 500 "Internal Server Error".  The status code for such responses can be retrieved by calling [response.status](/api/class-response.mdx#response-status).

:::note

The method either throws an error or returns a main resource response. The only exceptions are navigation to `about:blank` or navigation to the same URL with a different hash, which would succeed and return `null`.
:::

:::note
Headless mode doesn't support navigation to a PDF document. See the [upstream issue](https://bugs.chromium.org/p/chromium/issues/detail?id=761295).
:::

**Usage**

```python
page.goto(url)
page.goto(url, **kwargs)
```

**Arguments**
- `url` str
  
  URL to navigate page to. The url should include scheme, e.g. `https://`. When a [base_url](/api/class-browser.mdx#browser-new-context-option-base-url) via the context options was provided and the passed URL is a path, it gets merged via the [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor.
- `referer` str *(optional)*
  
  Referer header value. If provided it will take preference over the referer header value set by [page.set_extra_http_headers()](/api/class-page.mdx#page-set-extra-http-headers).
- `timeout` float *(optional)*
  
  Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_navigation_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [page.set_default_navigation_timeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.
- `wait_until` "load" | "domcontentloaded" | "networkidle" | "commit" *(optional)*
  
  When to consider operation succeeded, defaults to `load`. Events can be either:
  * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
  * `'load'` - consider operation to be finished when the `load` event is fired.
  * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
  * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- NoneType | Response

---

### hide_highlight {/* #page-hide-highlight */}



Hide all locator highlight overlays previously added by [locator.highlight()](/api/class-locator.mdx#locator-highlight) on this page.

**Usage**

```python
page.hide_highlight()
```

**Returns**
- NoneType

---

### locator {/* #page-locator */}



The method returns an element locator that can be used to perform actions on this page / frame. Locator is resolved to the element immediately before performing an action, so a series of actions on the same locator can in fact be performed on different DOM elements. That would happen if the DOM structure between those actions has changed.

[Learn more about locators](../locators.mdx).

**Usage**

```python
page.locator(selector)
page.locator(selector, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to use when resolving DOM element.
- `has` Locator *(optional)*
  
  Narrows down the results of the method to those which contain elements matching this relative locator. For example, `article` that has `text=Playwright` matches `<article><div>Playwright</div></article>`.
  
  Inner locator **must be relative** to the outer locator and is queried starting with the outer locator match, not the document root. For example, you can find `content` that has `div` in `<article><content><div>Playwright</div></content></article>`. However, looking for `content` that has `article div` will fail, because the inner locator must be relative and should not use any elements outside the `content`.
  
  Note that outer and inner locators must belong to the same frame. Inner locator must not contain FrameLocators.
- `has_not` Locator *(optional)* 
  
  Matches elements that do not contain an element that matches an inner locator. Inner locator is queried against the outer one. For example, `article` that does not have `div` matches `<article><span>Playwright</span></article>`.
  
  Note that outer and inner locators must belong to the same frame. Inner locator must not contain FrameLocators.
- `has_not_text` str | Pattern *(optional)* 
  
  Matches elements that do not contain specified text somewhere inside, possibly in a child or a descendant element. When passed a string, matching is case-insensitive and searches for a substring.
- `has_text` str | Pattern *(optional)*
  
  Matches elements containing specified text somewhere inside, possibly in a child or a descendant element. When passed a string, matching is case-insensitive and searches for a substring. For example, `"Playwright"` matches `<article><div>Playwright</div></article>`.

**Returns**
- Locator

---

### opener {/* #page-opener */}



Returns the opener for popup pages and `null` for others. If the opener has been closed already the returns `null`.

**Usage**

```python
page.opener()
```

**Returns**
- NoneType | Page

---

### page_errors {/* #page-page-errors */}



Returns up to (currently) 200 last page errors from this page. See [page.on("pageerror")](/api/class-page.mdx#page-event-page-error) for more details.

**Usage**

```python
page.page_errors()
page.page_errors(**kwargs)
```

**Arguments**
- `filter` "all" | "since-navigation" *(optional)* 
  
  Controls which errors are returned:

**Returns**
- List\[Error\]

---

### pause {/* #page-pause */}



Pauses script execution. Playwright will stop executing the script and wait for the user to either press the 'Resume' button in the page overlay or to call `playwright.resume()` in the DevTools console.

User can inspect selectors or perform manual steps while paused. Resume will continue running the original script from the place it was paused.

:::note

This method requires Playwright to be started in a headed mode, with a falsy [headless](/api/class-browsertype.mdx#browser-type-launch-option-headless) option.
:::

**Usage**

```python
page.pause()
```

**Returns**
- NoneType

---

### pdf {/* #page-pdf */}



Returns the PDF buffer.

`page.pdf()` generates a pdf of the page with `print` css media. To generate a pdf with `screen` media, call [page.emulate_media()](/api/class-page.mdx#page-emulate-media) before calling `page.pdf()`:

:::note

By default, `page.pdf()` generates a pdf with modified colors for printing. Use the [`-webkit-print-color-adjust`](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-print-color-adjust) property to force rendering of exact colors.
:::

**Usage**

**sync**

```py
# generates a pdf with "screen" media type.
page.emulate_media(media="screen")
page.pdf(path="page.pdf")
```

**async**

```py
# generates a pdf with "screen" media type.
await page.emulate_media(media="screen")
await page.pdf(path="page.pdf")
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

[header_template](/api/class-page.mdx#page-pdf-option-header-template) and [footer_template](/api/class-page.mdx#page-pdf-option-footer-template) markup have the following limitations: > 1. Script tags inside templates are not evaluated. > 2. Page styles are not visible inside templates.
:::

**Arguments**
- `display_header_footer` bool *(optional)*
  
  Display header and footer. Defaults to `false`.
- `footer_template` str *(optional)*
  
  HTML template for the print footer. Should use the same format as the [header_template](/api/class-page.mdx#page-pdf-option-header-template).
- `format` str *(optional)*
  
  Paper format. If set, takes priority over [width](/api/class-page.mdx#page-pdf-option-width) or [height](/api/class-page.mdx#page-pdf-option-height) options. Defaults to 'Letter'.
- `header_template` str *(optional)*
  
  HTML template for the print header. Should be valid HTML markup with following classes used to inject printing values into them:
  * `'date'` formatted print date
  * `'title'` document title
  * `'url'` document location
  * `'pageNumber'` current page number
  * `'totalPages'` total pages in the document
- `height` str | float *(optional)*
  
  Paper height, accepts values labeled with units.
- `landscape` bool *(optional)*
  
  Paper orientation. Defaults to `false`.
- `margin` Dict *(optional)*
  - `top` str | float *(optional)*
    
    Top margin, accepts values labeled with units. Defaults to `0`.
  - `right` str | float *(optional)*
    
    Right margin, accepts values labeled with units. Defaults to `0`.
  - `bottom` str | float *(optional)*
    
    Bottom margin, accepts values labeled with units. Defaults to `0`.
  - `left` str | float *(optional)*
    
    Left margin, accepts values labeled with units. Defaults to `0`.
  
  Paper margins, defaults to none.
- `outline` bool *(optional)* 
  
  Whether or not to embed the document outline into the PDF. Defaults to `false`.
- `page_ranges` str *(optional)*
  
  Paper ranges to print, e.g., '1-5, 8, 11-13'. Defaults to the empty string, which means print all pages.
- `path` Union\[str, pathlib.Path\] *(optional)*
  
  The file path to save the PDF to. If [path](/api/class-page.mdx#page-pdf-option-path) is a relative path, then it is resolved relative to the current working directory. If no path is provided, the PDF won't be saved to the disk.
- `prefer_css_page_size` bool *(optional)*
  
  Give any CSS `@page` size declared in the page priority over what is declared in [width](/api/class-page.mdx#page-pdf-option-width) and [height](/api/class-page.mdx#page-pdf-option-height) or [format](/api/class-page.mdx#page-pdf-option-format) options. Defaults to `false`, which will scale the content to fit the paper size.
- `print_background` bool *(optional)*
  
  Print background graphics. Defaults to `false`.
- `scale` float *(optional)*
  
  Scale of the webpage rendering. Defaults to `1`. Scale amount must be between 0.1 and 2.
- `tagged` bool *(optional)* 
  
  Whether or not to generate tagged (accessible) PDF. Defaults to `false`.
- `width` str | float *(optional)*
  
  Paper width, accepts values labeled with units.

**Returns**
- bytes

---

### pick_locator {/* #page-pick-locator */}



Enters pick locator mode where hovering over page elements highlights them and shows the corresponding locator. Once the user clicks an element, the mode is deactivated and the Locator for the picked element is returned.

**Usage**

**sync**

```py
locator = page.pick_locator()
print(locator)
```

**async**

```py
locator = await page.pick_locator()
print(locator)
```

**Returns**
- Locator

---

### reload {/* #page-reload */}



This method reloads the current page, in the same way as if the user had triggered a browser refresh. Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect.

**Usage**

```python
page.reload()
page.reload(**kwargs)
```

**Arguments**
- `timeout` float *(optional)*
  
  Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_navigation_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [page.set_default_navigation_timeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.
- `wait_until` "load" | "domcontentloaded" | "networkidle" | "commit" *(optional)*
  
  When to consider operation succeeded, defaults to `load`. Events can be either:
  * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
  * `'load'` - consider operation to be finished when the `load` event is fired.
  * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
  * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- NoneType | Response

---

### remove_locator_handler {/* #page-remove-locator-handler */}



Removes all locator handlers added by [page.add_locator_handler()](/api/class-page.mdx#page-add-locator-handler) for a specific locator.

**Usage**

```python
page.remove_locator_handler(locator)
```

**Arguments**
- `locator` Locator
  
  Locator passed to [page.add_locator_handler()](/api/class-page.mdx#page-add-locator-handler).

**Returns**
- NoneType

---

### request_gc {/* #page-request-gc */}



Request the page to perform garbage collection. Note that there is no guarantee that all unreachable objects will be collected.

This is useful to help detect memory leaks. For example, if your page has a large object `'suspect'` that might be leaked, you can check that it does not leak by using a [`WeakRef`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef).

**sync**

```py
# 1. In your page, save a WeakRef for the "suspect".
page.evaluate("globalThis.suspectWeakRef = new WeakRef(suspect)")
# 2. Request garbage collection.
page.request_gc()
# 3. Check that weak ref does not deref to the original object.
assert page.evaluate("!globalThis.suspectWeakRef.deref()")
```

**async**

```py
# 1. In your page, save a WeakRef for the "suspect".
await page.evaluate("globalThis.suspectWeakRef = new WeakRef(suspect)")
# 2. Request garbage collection.
await page.request_gc()
# 3. Check that weak ref does not deref to the original object.
assert await page.evaluate("!globalThis.suspectWeakRef.deref()")
```

**Usage**

```python
page.request_gc()
```

**Returns**
- NoneType

---

### requests {/* #page-requests */}



Returns up to (currently) 100 last network request from this page. See [page.on("request")](/api/class-page.mdx#page-event-request) for more details.

Returned requests should be accessed immediately, otherwise they might be collected to prevent unbounded memory growth as new requests come in. Once collected, retrieving most information about the request is impossible.

Note that requests reported through the [page.on("request")](/api/class-page.mdx#page-event-request) request are not collected, so there is a trade off between efficient memory usage with [page.requests()](/api/class-page.mdx#page-requests) and the amount of available information reported through [page.on("request")](/api/class-page.mdx#page-event-request).

**Usage**

```python
page.requests()
```

**Returns**
- List\[Request\]

---

### route {/* #page-route */}



Routing provides the capability to modify network requests that are made by a page.

Once routing is enabled, every request matching the url pattern will stall unless it's continued, fulfilled or aborted.

:::note

The handler will only be called for the first url if the response is a redirect.
:::

:::note
[page.route()](/api/class-page.mdx#page-route) will not intercept requests intercepted by Service Worker. See [this](https://github.com/microsoft/playwright/issues/1090) issue. We recommend disabling Service Workers when using request interception by setting [service_workers](/api/class-browser.mdx#browser-new-context-option-service-workers) to `'block'`.
:::

:::note
[page.route()](/api/class-page.mdx#page-route) will not intercept the first request of a popup page. Use [browser_context.route()](/api/class-browsercontext.mdx#browser-context-route) instead.
:::

**Usage**

An example of a naive handler that aborts all image requests:

**sync**

```py
page = browser.new_page()
page.route("**/*.{png,jpg,jpeg}", lambda route: route.abort())
page.goto("https://example.com")
browser.close()
```

**async**

```py
page = await browser.new_page()
await page.route("**/*.{png,jpg,jpeg}", lambda route: route.abort())
await page.goto("https://example.com")
await browser.close()
```

or the same snippet using a regex pattern instead:

**sync**

```py
page = browser.new_page()
page.route(re.compile(r"(\.png$)|(\.jpg$)"), lambda route: route.abort())
page.goto("https://example.com")
browser.close()
```

**async**

```py
page = await browser.new_page()
await page.route(re.compile(r"(\.png$)|(\.jpg$)"), lambda route: route.abort())
await page.goto("https://example.com")
await browser.close()
```

It is possible to examine the request to decide the route action. For example, mocking all requests that contain some post data, and leaving all other requests as is:

**sync**

```py
def handle_route(route: Route):
  if ("my-string" in route.request.post_data):
    route.fulfill(body="mocked-data")
  else:
    route.continue_()
page.route("/api/**", handle_route)
```

**async**

```py
async def handle_route(route: Route):
  if ("my-string" in route.request.post_data):
    await route.fulfill(body="mocked-data")
  else:
    await route.continue_()
await page.route("/api/**", handle_route)
```

If a request matches multiple registered routes, the most recently registered route takes precedence.

Page routes take precedence over browser context routes (set up with [browser_context.route()](/api/class-browsercontext.mdx#browser-context-route)) when request matches both handlers.

To remove a route with its handler you can use [page.unroute()](/api/class-page.mdx#page-unroute).

:::note

Enabling routing disables http cache.
:::

**Arguments**
- `url` str | Pattern | Callable\[URL\]:bool
  
  A glob pattern, regex pattern, or predicate that receives a URL to match during routing. If [base_url](/api/class-browser.mdx#browser-new-context-option-base-url) is set in the context options and the provided URL is a string that does not start with `*`, it is resolved using the [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor.
- `handler` Callable\[Route, Request\]:Promise\[Any\] | Any
  
  handler function to route the request.
- `times` int *(optional)* 
  
  How often a route should be used. By default it will be used every time.

**Returns**
- Disposable

---

### route_from_har {/* #page-route-from-har */}



If specified the network requests that are made in the page will be served from the HAR file. Read more about [Replaying from HAR](../mock.mdx#replaying-from-har).

Playwright will not serve requests intercepted by Service Worker from the HAR file. See [this](https://github.com/microsoft/playwright/issues/1090) issue. We recommend disabling Service Workers when using request interception by setting [service_workers](/api/class-browser.mdx#browser-new-context-option-service-workers) to `'block'`.

**Usage**

```python
page.route_from_har(har)
page.route_from_har(har, **kwargs)
```

**Arguments**
- `har` Union\[str, pathlib.Path\]
  
  Path to a [HAR](http://www.softwareishard.com/blog/har-12-spec) file with prerecorded network data. If `path` is a relative path, then it is resolved relative to the current working directory.
- `not_found` "abort" | "fallback" *(optional)*
  * If set to 'abort' any request not found in the HAR file will be aborted.
  * If set to 'fallback' missing requests will be sent to the network.
  
  Defaults to abort.
- `update` bool *(optional)*
  
  If specified, updates the given HAR with the actual network information instead of serving from file. The file is written to disk when [browser_context.close()](/api/class-browsercontext.mdx#browser-context-close) is called.
- `update_content` "embed" | "attach" *(optional)* 
  
  Optional setting to control resource content management. If `attach` is specified, resources are persisted as separate files or entries in the ZIP archive. If `embed` is specified, content is stored inline the HAR file.
- `update_mode` "full" | "minimal" *(optional)* 
  
  When set to `minimal`, only record information necessary for routing from HAR. This omits sizes, timing, page, cookies, security and other types of HAR information that are not used when replaying from HAR. Defaults to `minimal`.
- `url` str | Pattern *(optional)*
  
  A glob pattern, regular expression or predicate to match the request URL. Only requests with URL matching the pattern will be served from the HAR file. If not specified, all requests are served from the HAR file.

**Returns**
- NoneType

---

### route_web_socket {/* #page-route-web-socket */}



This method allows to modify websocket connections that are made by the page.

Note that only `WebSocket`s created after this method was called will be routed. It is recommended to call this method before navigating the page.

**Usage**

Below is an example of a simple mock that responds to a single message. See WebSocketRoute for more details and examples.

**sync**

```py
def message_handler(ws: WebSocketRoute, message: Unionstr, bytes):
  if message == "request":
    ws.send("response")

def handler(ws: WebSocketRoute):
  ws.on_message(lambda message: message_handler(ws, message))

page.route_web_socket("/ws", handler)
```

**async**

```py
def message_handler(ws: WebSocketRoute, message: Unionstr, bytes):
  if message == "request":
    ws.send("response")

def handler(ws: WebSocketRoute):
  ws.on_message(lambda message: message_handler(ws, message))

await page.route_web_socket("/ws", handler)
```

**Arguments**
- `url` str | Pattern | Callable\[URL\]:bool
  
  Only WebSockets with the url matching this pattern will be routed. A string pattern can be relative to the [base_url](/api/class-browser.mdx#browser-new-context-option-base-url) context option.
- `handler` Callable\[WebSocketRoute\]:Promise\[Any\] | Any
  
  Handler function to route the WebSocket.

**Returns**
- NoneType

---

### screenshot {/* #page-screenshot */}



Returns the buffer with the captured screenshot.

**Usage**

```python
page.screenshot()
page.screenshot(**kwargs)
```

**Arguments**
- `animations` "disabled" | "allow" *(optional)*
  
  When set to `"disabled"`, stops CSS animations, CSS transitions and Web Animations. Animations get different treatment depending on their duration:
  * finite animations are fast-forwarded to completion, so they'll fire `transitionend` event.
  * infinite animations are canceled to initial state, and then played over after the screenshot.
  
  Defaults to `"allow"` that leaves animations untouched.
- `caret` "hide" | "initial" *(optional)*
  
  When set to `"hide"`, screenshot will hide text caret. When set to `"initial"`, text caret behavior will not be changed.  Defaults to `"hide"`.
- `clip` Dict *(optional)*
  - `x` float
    
    x-coordinate of top-left corner of clip area
  - `y` float
    
    y-coordinate of top-left corner of clip area
  - `width` float
    
    width of clipping area
  - `height` float
    
    height of clipping area
  
  An object which specifies clipping of the resulting image.
- `full_page` bool *(optional)*
  
  When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Defaults to `false`.
- `mask` List\[Locator\] *(optional)*
  
  Specify locators that should be masked when the screenshot is taken. Masked elements will be overlaid with a pink box `#FF00FF` (customized by [mask_color](/api/class-page.mdx#page-screenshot-option-mask-color)) that completely covers its bounding box. The mask is also applied to invisible elements, see [Matching only visible elements](../locators.mdx#matching-only-visible-elements) to disable that.
- `mask_color` str *(optional)* 
  
  Specify the color of the overlay box for masked elements, in [CSS color format](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value). Default color is pink `#FF00FF`.
- `omit_background` bool *(optional)*
  
  Hides default white background and allows capturing screenshots with transparency. Not applicable to `jpeg` images. Defaults to `false`.
- `path` Union\[str, pathlib.Path\] *(optional)*
  
  The file path to save the image to. The screenshot type will be inferred from file extension. If [path](/api/class-page.mdx#page-screenshot-option-path) is a relative path, then it is resolved relative to the current working directory. If no path is provided, the image won't be saved to the disk.
- `quality` int *(optional)*
  
  The quality of the image, between 0-100. Not applicable to `png` images. For `jpeg` the default is `80`. For `webp`, a quality of `100` (the default) produces a lossless image, while lower values use lossy compression.
- `scale` "css" | "device" *(optional)*
  
  When set to `"css"`, screenshot will have a single pixel per each css pixel on the page. For high-dpi devices, this will keep screenshots small. Using `"device"` option will produce a single pixel per each device pixel, so screenshots of high-dpi devices will be twice as large or even larger.
  
  Defaults to `"device"`.
- `style` str *(optional)* 
  
  Text of the stylesheet to apply while making the screenshot. This is where you can hide dynamic elements, make elements invisible or change their properties to help you creating repeatable screenshots. This stylesheet pierces the Shadow DOM and applies to the inner frames.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.
- `type` "png" | "jpeg" | "webp" *(optional)*
  
  Specify screenshot type, defaults to `png`.

**Returns**
- bytes

---

### set_content {/* #page-set-content */}



This method internally calls [document.write()](https://developer.mozilla.org/en-US/docs/Web/API/Document/write), inheriting all its specific characteristics and behaviors.

**Usage**

```python
page.set_content(html)
page.set_content(html, **kwargs)
```

**Arguments**
- `html` str
  
  HTML markup to assign to the page.
- `timeout` float *(optional)*
  
  Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_navigation_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [page.set_default_navigation_timeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.
- `wait_until` "load" | "domcontentloaded" | "networkidle" | "commit" *(optional)*
  
  When to consider operation succeeded, defaults to `load`. Events can be either:
  * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
  * `'load'` - consider operation to be finished when the `load` event is fired.
  * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
  * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- NoneType

---

### set_default_navigation_timeout {/* #page-set-default-navigation-timeout */}



This setting will change the default maximum navigation time for the following methods and related shortcuts:
* [page.go_back()](/api/class-page.mdx#page-go-back)
* [page.go_forward()](/api/class-page.mdx#page-go-forward)
* [page.goto()](/api/class-page.mdx#page-goto)
* [page.reload()](/api/class-page.mdx#page-reload)
* [page.set_content()](/api/class-page.mdx#page-set-content)
* [page.expect_navigation()](/api/class-page.mdx#page-wait-for-navigation)
* [page.wait_for_url()](/api/class-page.mdx#page-wait-for-url)

:::note

[page.set_default_navigation_timeout()](/api/class-page.mdx#page-set-default-navigation-timeout) takes priority over [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout), [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) and [browser_context.set_default_navigation_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout).
:::

**Usage**

```python
page.set_default_navigation_timeout(timeout)
```

**Arguments**
- `timeout` float
  
  Maximum navigation time in milliseconds

---

### set_default_timeout {/* #page-set-default-timeout */}



This setting will change the default maximum time for all the methods accepting [timeout](/api/class-page.mdx#page-set-default-timeout-option-timeout) option.

:::note

[page.set_default_navigation_timeout()](/api/class-page.mdx#page-set-default-navigation-timeout) takes priority over [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout).
:::

**Usage**

```python
page.set_default_timeout(timeout)
```

**Arguments**
- `timeout` float
  
  Maximum time in milliseconds. Pass `0` to disable timeout.

---

### set_extra_http_headers {/* #page-set-extra-http-headers */}



The extra HTTP headers will be sent with every request the page initiates.

:::note

[page.set_extra_http_headers()](/api/class-page.mdx#page-set-extra-http-headers) does not guarantee the order of headers in the outgoing requests.
:::

**Usage**

```python
page.set_extra_http_headers(headers)
```

**Arguments**
- `headers` Dict\[str, str\]
  
  An object containing additional HTTP headers to be sent with every request. All header values must be strings.

**Returns**
- NoneType

---

### set_viewport_size {/* #page-set-viewport-size */}



In the case of multiple pages in a single browser, each page can have its own viewport size. However, [browser.new_context()](/api/class-browser.mdx#browser-new-context) allows to set viewport size (and more) for all pages in the context at once.

[page.set_viewport_size()](/api/class-page.mdx#page-set-viewport-size) will resize the page. A lot of websites don't expect phones to change size, so you should set the viewport size before navigating to the page. [page.set_viewport_size()](/api/class-page.mdx#page-set-viewport-size) will also reset `screen` size, use [browser.new_context()](/api/class-browser.mdx#browser-new-context) with `screen` and `viewport` parameters if you need better control of these properties.

**Usage**

**sync**

```py
page = browser.new_page()
page.set_viewport_size({"width": 640, "height": 480})
page.goto("https://example.com")
```

**async**

```py
page = await browser.new_page()
await page.set_viewport_size({"width": 640, "height": 480})
await page.goto("https://example.com")
```

**Arguments**
- `viewport_size` Dict
  - `width` int
    
    page width in pixels.
  - `height` int
    
    page height in pixels.

**Returns**
- NoneType

---

### title {/* #page-title */}



Returns the page's title.

**Usage**

```python
page.title()
```

**Returns**
- str

---

### unroute {/* #page-unroute */}



Removes a route created with [page.route()](/api/class-page.mdx#page-route). When [handler](/api/class-page.mdx#page-unroute-option-handler) is not specified, removes all routes for the [url](/api/class-page.mdx#page-unroute-option-url).

**Usage**

```python
page.unroute(url)
page.unroute(url, **kwargs)
```

**Arguments**
- `url` str | Pattern | Callable\[URL\]:bool
  
  A glob pattern, regex pattern, or predicate receiving URL to match while routing.
- `handler` Callable\[Route, Request\]:Promise\[Any\] | Any *(optional)*
  
  Optional handler function to route the request.

**Returns**
- NoneType

---

### unroute_all {/* #page-unroute-all */}



Removes all routes created with [page.route()](/api/class-page.mdx#page-route) and [page.route_from_har()](/api/class-page.mdx#page-route-from-har).

**Usage**

```python
page.unroute_all()
page.unroute_all(**kwargs)
```

**Arguments**
- `behavior` "wait" | "ignoreErrors" | "default" *(optional)*
  
  Specifies whether to wait for already running handlers and what to do if they throw errors:
  * `'default'` - do not wait for current handler calls (if any) to finish, if unrouted handler throws, it may result in unhandled error
  * `'wait'` - wait for current handler calls (if any) to finish
  * `'ignoreErrors'` - do not wait for current handler calls (if any) to finish, all errors thrown by the handlers after unrouting are silently caught

**Returns**
- NoneType

---

### wait_for_event {/* #page-wait-for-event-2 */}



:::note

In most cases, you should use [page.expect_event()](/api/class-page.mdx#page-wait-for-event).
:::

Waits for given `event` to fire. If predicate is provided, it passes event's value into the `predicate` function and waits for `predicate(event)` to return a truthy value. Will throw an error if the page is closed before the `event` is fired.

**Usage**

```python
page.wait_for_event(event)
page.wait_for_event(event, **kwargs)
```

**Arguments**
- `event` str
  
  Event name, same one typically passed into `*.on(event)`.
- `predicate` Callable *(optional)*
  
  Receives the event data and resolves to truthy value when the waiting should resolve.
- `timeout` float *(optional)*
  
  Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout).

**Returns**
- Any

---

### wait_for_function {/* #page-wait-for-function */}



Returns when the [expression](/api/class-page.mdx#page-wait-for-function-option-expression) returns a truthy value. It resolves to a JSHandle of the truthy value.

**Usage**

The [page.wait_for_function()](/api/class-page.mdx#page-wait-for-function) can be used to observe viewport size change:

**sync**

```py
from playwright.sync_api import sync_playwright, Playwright

def run(playwright: Playwright):
    webkit = playwright.webkit
    browser = webkit.launch()
    page = browser.new_page()
    page.evaluate("window.x = 0; setTimeout(() => { window.x = 100 }, 1000);")
    page.wait_for_function("() => window.x > 0")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
```

**async**

```py
import asyncio
from playwright.async_api import async_playwright, Playwright

async def run(playwright: Playwright):
    webkit = playwright.webkit
    browser = await webkit.launch()
    page = await browser.new_page()
    await page.evaluate("window.x = 0; setTimeout(() => { window.x = 100 }, 1000);")
    await page.wait_for_function("() => window.x > 0")
    await browser.close()

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())
```

To pass an argument to the predicate of [page.wait_for_function()](/api/class-page.mdx#page-wait-for-function) function:

**sync**

```py
selector = ".foo"
page.wait_for_function("selector => !!document.querySelector(selector)", selector)
```

**async**

```py
selector = ".foo"
await page.wait_for_function("selector => !!document.querySelector(selector)", selector)
```

**Arguments**
- `expression` str
  
  JavaScript expression to be evaluated in the browser context. If the expression evaluates to a function, the function is automatically invoked.
- `arg` EvaluationArgument *(optional)*
  
  Optional argument to pass to [expression](/api/class-page.mdx#page-wait-for-function-option-expression).
- `polling` float | "raf" *(optional)*
  
  If [polling](/api/class-page.mdx#page-wait-for-function-option-polling) is `'raf'`, then [expression](/api/class-page.mdx#page-wait-for-function-option-expression) is constantly executed in `requestAnimationFrame` callback. If [polling](/api/class-page.mdx#page-wait-for-function-option-polling) is a number, then it is treated as an interval in milliseconds at which the function would be executed. Defaults to `raf`.
- `timeout` float *(optional)*
  
  Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- JSHandle

---

### wait_for_load_state {/* #page-wait-for-load-state */}



Returns when the required load state has been reached.

This resolves when the page reaches a required load state, `load` by default. The navigation must have been committed when this method is called. If current document has already reached the required state, resolves immediately.

:::note

Most of the time, this method is not needed because Playwright [auto-waits before every action](../actionability.mdx).
:::

**Usage**

**sync**

```py
page.get_by_role("button").click() # click triggers navigation.
page.wait_for_load_state() # the promise resolves after "load" event.
```

**async**

```py
await page.get_by_role("button").click() # click triggers navigation.
await page.wait_for_load_state() # the promise resolves after "load" event.
```

**sync**

```py
with page.expect_popup() as page_info:
    page.get_by_role("button").click() # click triggers a popup.
popup = page_info.value
# Wait for the "DOMContentLoaded" event.
popup.wait_for_load_state("domcontentloaded")
print(popup.title()) # popup is ready to use.
```

**async**

```py
async with page.expect_popup() as page_info:
    await page.get_by_role("button").click() # click triggers a popup.
popup = await page_info.value
# Wait for the "DOMContentLoaded" event.
await popup.wait_for_load_state("domcontentloaded")
print(await popup.title()) # popup is ready to use.
```

**Arguments**
- `state` "load" | "domcontentloaded" | "networkidle" *(optional)*
  
  Optional load state to wait for, defaults to `load`. If the state has been already reached while loading current document, the method resolves immediately. Can be one of:
  * `'load'` - wait for the `load` event to be fired.
  * `'domcontentloaded'` - wait for the `DOMContentLoaded` event to be fired.
  * `'networkidle'` - **DISCOURAGED** wait until there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
- `timeout` float *(optional)*
  
  Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_navigation_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [page.set_default_navigation_timeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- NoneType

---

### wait_for_url {/* #page-wait-for-url */}



Waits for the main frame to navigate to the given URL.

**Usage**

**sync**

```py
page.click("a.delayed-navigation") # clicking the link will indirectly cause a navigation
page.wait_for_url("**/target.html")
```

**async**

```py
await page.click("a.delayed-navigation") # clicking the link will indirectly cause a navigation
await page.wait_for_url("**/target.html")
```

**Arguments**
- `url` str | Pattern | Callable\[URL\]:bool
  
  A glob pattern, regex pattern, or predicate receiving URL to match while waiting for the navigation. Note that if the parameter is a string without wildcard characters, the method will wait for navigation to URL that is exactly equal to the string.
- `timeout` float *(optional)*
  
  Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_navigation_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [page.set_default_navigation_timeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.
- `wait_until` "load" | "domcontentloaded" | "networkidle" | "commit" *(optional)*
  
  When to consider operation succeeded, defaults to `load`. Events can be either:
  * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
  * `'load'` - consider operation to be finished when the `load` event is fired.
  * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
  * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- NoneType

---

## Properties

### clock {/* #page-clock */}



Playwright has ability to mock clock and passage of time.

**Usage**

```python
page.clock
```

**Type**
- Clock

---

### context {/* #page-context */}



Get the browser context that the page belongs to.

**Usage**

```python
page.context
```

**Returns**
- BrowserContext

---

### frames {/* #page-frames */}



An array of all frames attached to the page.

**Usage**

```python
page.frames
```

**Returns**
- List\[Frame\]

---

### is_closed {/* #page-is-closed */}



Indicates that the page has been closed.

**Usage**

```python
page.is_closed()
```

**Returns**
- bool

---

### keyboard {/* #page-keyboard */}



**Usage**

```python
page.keyboard
```

**Type**
- Keyboard

---

### local_storage {/* #page-local-storage */}



Provides access to the page's `localStorage` for the current origin. See WebStorage.

**Usage**

```python
page.local_storage
```

**Type**
- WebStorage

---

### main_frame {/* #page-main-frame */}



The page's main frame. Page is guaranteed to have a main frame which persists during navigations.

**Usage**

```python
page.main_frame
```

**Returns**
- Frame

---

### mouse {/* #page-mouse */}



**Usage**

```python
page.mouse
```

**Type**
- Mouse

---

### request {/* #page-request */}



API testing helper associated with this page. This method returns the same instance as [browser_context.request](/api/class-browsercontext.mdx#browser-context-request) on the page's context. See [browser_context.request](/api/class-browsercontext.mdx#browser-context-request) for more details.

**Usage**

```python
page.request
```

**Type**
- APIRequestContext

---

### screencast {/* #page-screencast */}



Screencast object associated with this page.

**Usage**

**Type**
- Screencast

---

### session_storage {/* #page-session-storage */}



Provides access to the page's `sessionStorage` for the current origin. See WebStorage.

**Usage**

```python
page.session_storage
```

**Type**
- WebStorage

---

### touchscreen {/* #page-touchscreen */}



**Usage**

```python
page.touchscreen
```

**Type**
- Touchscreen

---

### url {/* #page-url */}



**Usage**

```python
page.url
```

**Returns**
- str

---

### video {/* #page-video */}



Video object associated with this page. Can be used to access the video file when using the `recordVideo` context option.

**Usage**

```python
page.video
```

**Returns**
- NoneType | Video

---

### viewport_size {/* #page-viewport-size */}



**Usage**

```python
page.viewport_size
```

**Returns**
- NoneType | Dict
  - `width` int
    
    page width in pixels.
  - `height` int
    
    page height in pixels.

---

### workers {/* #page-workers */}



This method returns all of the dedicated [WebWorkers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) associated with the page.

:::note

This does not contain ServiceWorkers
:::

**Usage**

```python
page.workers
```

**Returns**
- List\[Worker\]

---

## Events

### on("close") {/* #page-event-close */}



Emitted when the page closes.

**Usage**

```python
page.on("close", handler)
```

**Event data**
- Page

---

### on("console") {/* #page-event-console */}



Emitted when JavaScript within the page calls one of console API methods, e.g. `console.log` or `console.dir`.

The arguments passed into `console.log` are available on the ConsoleMessage event handler argument.

**Usage**

**sync**

```py
def print_args(msg):
    for arg in msg.args:
        print(arg.json_value())

page.on("console", print_args)
page.evaluate("console.log('hello', 5, { foo: 'bar' })")
```

**async**

```py
async def print_args(msg):
    values = []
    for arg in msg.args:
        values.append(await arg.json_value())
    print(values)

page.on("console", print_args)
await page.evaluate("console.log('hello', 5, { foo: 'bar' })")
```

**Event data**
- ConsoleMessage

---

### on("crash") {/* #page-event-crash */}



Emitted when the page crashes. Browser pages might crash if they try to allocate too much memory. When the page crashes, ongoing and subsequent operations will throw.

The most common way to deal with crashes is to catch an exception:

**sync**

```py
try:
    # crash might happen during a click.
    page.click("button")
    # or while waiting for an event.
    page.wait_for_event("popup")
except Error as e:
    pass
    # when the page crashes, exception message contains "crash".
```

**async**

```py
try:
    # crash might happen during a click.
    await page.click("button")
    # or while waiting for an event.
    await page.wait_for_event("popup")
except Error as e:
    pass
    # when the page crashes, exception message contains "crash".
```

**Usage**

```python
page.on("crash", handler)
```

**Event data**
- Page

---

### on("dialog") {/* #page-event-dialog */}



Emitted when a JavaScript dialog appears, such as `alert`, `prompt`, `confirm` or `beforeunload`. Listener **must** either [dialog.accept()](/api/class-dialog.mdx#dialog-accept) or [dialog.dismiss()](/api/class-dialog.mdx#dialog-dismiss) the dialog - otherwise the page will [freeze](https://developer.mozilla.org/en-US/docs/Web/JavaScript/EventLoop#never_blocking) waiting for the dialog, and actions like click will never finish.

**Usage**

```python
page.on("dialog", lambda dialog: dialog.accept())
```

:::note
When no [page.on("dialog")](/api/class-page.mdx#page-event-dialog) or [browser_context.on("dialog")](/api/class-browsercontext.mdx#browser-context-event-dialog) listeners are present, all dialogs are automatically dismissed.
:::

**Event data**
- Dialog

---

### on("domcontentloaded") {/* #page-event-dom-content-loaded */}



Emitted when the JavaScript [`DOMContentLoaded`](https://developer.mozilla.org/en-US/docs/Web/Events/DOMContentLoaded) event is dispatched.

**Usage**

```python
page.on("domcontentloaded", handler)
```

**Event data**
- Page

---

### on("download") {/* #page-event-download */}



Emitted when attachment download started. User can access basic file operations on downloaded content via the passed Download instance.

**Usage**

```python
page.on("download", handler)
```

**Event data**
- Download

---

### on("filechooser") {/* #page-event-file-chooser */}



Emitted when a file chooser is supposed to appear, such as after clicking the  `<input type=file>`. Playwright can respond to it via setting the input files using [file_chooser.set_files()](/api/class-filechooser.mdx#file-chooser-set-files) that can be uploaded after that.

```py
page.on("filechooser", lambda file_chooser: file_chooser.set_files("/tmp/myfile.pdf"))
```

**Usage**

```python
page.on("filechooser", handler)
```

**Event data**
- FileChooser

---

### on("frameattached") {/* #page-event-frame-attached */}



Emitted when a frame is attached.

**Usage**

```python
page.on("frameattached", handler)
```

**Event data**
- Frame

---

### on("framedetached") {/* #page-event-frame-detached */}



Emitted when a frame is detached.

**Usage**

```python
page.on("framedetached", handler)
```

**Event data**
- Frame

---

### on("framenavigated") {/* #page-event-frame-navigated */}



Emitted when a frame is navigated to a new url.

**Usage**

```python
page.on("framenavigated", handler)
```

**Event data**
- Frame

---

### on("load") {/* #page-event-load */}



Emitted when the JavaScript [`load`](https://developer.mozilla.org/en-US/docs/Web/Events/load) event is dispatched.

**Usage**

```python
page.on("load", handler)
```

**Event data**
- Page

---

### on("pageerror") {/* #page-event-page-error */}



Emitted when an uncaught exception happens within the page.

**sync**

```py
# Log all uncaught errors to the terminal
page.on("pageerror", lambda exc: print(f"uncaught exception: {exc}"))

# Navigate to a page with an exception.
page.goto("data:text/html,<script>throw new Error('test')</script>")
```

**async**

```py
# Log all uncaught errors to the terminal
page.on("pageerror", lambda exc: print(f"uncaught exception: {exc}"))

# Navigate to a page with an exception.
await page.goto("data:text/html,<script>throw new Error('test')</script>")
```

**Usage**

```python
page.on("pageerror", handler)
```

**Event data**
- Error

---

### on("popup") {/* #page-event-popup */}



Emitted when the page opens a new tab or window. This event is emitted in addition to the [browser_context.on("page")](/api/class-browsercontext.mdx#browser-context-event-page), but only for popups relevant to this page.

The earliest moment that page is available is when it has navigated to the initial url. For example, when opening a popup with `window.open('http://example.com')`, this event will fire when the network request to "http://example.com" is done and its response has started loading in the popup. If you would like to route/listen to this network request, use [browser_context.route()](/api/class-browsercontext.mdx#browser-context-route) and [browser_context.on("request")](/api/class-browsercontext.mdx#browser-context-event-request) respectively instead of similar methods on the Page.

**sync**

```py
with page.expect_event("popup") as page_info:
    page.get_by_text("open the popup").click()
popup = page_info.value
print(popup.evaluate("location.href"))
```

**async**

```py
async with page.expect_event("popup") as page_info:
    await page.get_by_text("open the popup").click()
popup = await page_info.value
print(await popup.evaluate("location.href"))
```

:::note

Use [page.wait_for_load_state()](/api/class-page.mdx#page-wait-for-load-state) to wait until the page gets to a particular state (you should not need it in most cases).
:::

**Usage**

```python
page.on("popup", handler)
```

**Event data**
- Page

---

### on("request") {/* #page-event-request */}



Emitted when a page issues a request. The request object is read-only. In order to intercept and mutate requests, see [page.route()](/api/class-page.mdx#page-route) or [browser_context.route()](/api/class-browsercontext.mdx#browser-context-route).

**Usage**

```python
page.on("request", handler)
```

**Event data**
- Request

---

### on("requestfailed") {/* #page-event-request-failed */}



Emitted when a request fails, for example by timing out.

```python
page.on("requestfailed", lambda request: print(request.url + " " + request.failure.error_text))
```

:::note
HTTP Error responses, such as 404 or 503, are still successful responses from HTTP standpoint, so request will complete with [page.on("requestfinished")](/api/class-page.mdx#page-event-request-finished) event and not with [page.on("requestfailed")](/api/class-page.mdx#page-event-request-failed). A request will only be considered failed when the client cannot get an HTTP response from the server, e.g. due to network error net::ERR_FAILED.
:::

**Usage**

```python
page.on("requestfailed", handler)
```

**Event data**
- Request

---

### on("requestfinished") {/* #page-event-request-finished */}



Emitted when a request finishes successfully after downloading the response body. For a successful response, the sequence of events is `request`, `response` and `requestfinished`.

**Usage**

```python
page.on("requestfinished", handler)
```

**Event data**
- Request

---

### on("response") {/* #page-event-response */}



Emitted when response status and headers are received for a request. For a successful response, the sequence of events is `request`, `response` and `requestfinished`.

**Usage**

```python
page.on("response", handler)
```

**Event data**
- Response

---

### on("websocket") {/* #page-event-web-socket */}



Emitted when WebSocket request is sent.

**Usage**

```python
page.on("websocket", handler)
```

**Event data**
- WebSocket

---

### on("worker") {/* #page-event-worker */}



Emitted when a dedicated [WebWorker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) is spawned by the page.

**Usage**

```python
page.on("worker", handler)
```

**Event data**
- Worker

---

## Deprecated

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

```python
page.check(selector)
page.check(selector, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `force` bool *(optional)*
  
  Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
- `no_wait_after` bool *(optional)*
  
  :::warningDeprecated
  This option has no effect.
  :::
  
  
  This option has no effect.
- `position` Dict *(optional)* 
  - `x` float
    
    
  - `y` float
    
    
  A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
- `scroll` "auto" | "none" *(optional)* 
  
  Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.
- `trial` bool *(optional)* 
  
  When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it.

**Returns**
- NoneType

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
1. Wait for initiated navigations to either succeed or fail, unless [no_wait_after](/api/class-page.mdx#page-click-option-no-wait-after) option is set.

When all steps combined have not finished during the specified [timeout](/api/class-page.mdx#page-click-option-timeout), this method throws a TimeoutError. Passing zero timeout disables this.

**Usage**

```python
page.click(selector)
page.click(selector, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `button` "left" | "right" | "middle" *(optional)*
  
  Defaults to `left`.
- `click_count` int *(optional)*
  
  defaults to 1. See UIEvent.detail.
- `delay` float *(optional)*
  
  Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
- `force` bool *(optional)*
  
  Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
- `modifiers` List\"Alt" | "Control" | "ControlOrMeta" | "Meta" | "Shift"\ *(optional)*
  
  Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used. "ControlOrMeta" resolves to "Control" on Windows and Linux and to "Meta" on macOS.
- `no_wait_after` bool *(optional)*
  
  :::warningDeprecated
  This option will default to `true` in the future.
  :::
  
  
  Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
- `position` Dict *(optional)*
  - `x` float
    
    
  - `y` float
    
    
  A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
- `scroll` "auto" | "none" *(optional)* 
  
  Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.
- `trial` bool *(optional)* 
  
  When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it. Note that keyboard `modifiers` will be pressed regardless of `trial` to allow testing elements which are only visible when those keys are pressed.

**Returns**
- NoneType

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

```python
page.dblclick(selector)
page.dblclick(selector, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `button` "left" | "right" | "middle" *(optional)*
  
  Defaults to `left`.
- `delay` float *(optional)*
  
  Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.
- `force` bool *(optional)*
  
  Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
- `modifiers` List\"Alt" | "Control" | "ControlOrMeta" | "Meta" | "Shift"\ *(optional)*
  
  Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used. "ControlOrMeta" resolves to "Control" on Windows and Linux and to "Meta" on macOS.
- `no_wait_after` bool *(optional)*
  
  :::warningDeprecated
  This option has no effect.
  :::
  
  
  This option has no effect.
- `position` Dict *(optional)*
  - `x` float
    
    
  - `y` float
    
    
  A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
- `scroll` "auto" | "none" *(optional)* 
  
  Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.
- `trial` bool *(optional)* 
  
  When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it. Note that keyboard `modifiers` will be pressed regardless of `trial` to allow testing elements which are only visible when those keys are pressed.

**Returns**
- NoneType

---

### dispatch_event {/* #page-dispatch-event */}



:::warningDiscouraged

Use locator-based [locator.dispatch_event()](/api/class-locator.mdx#locator-dispatch-event) instead. Read more about [locators](../locators.mdx).

:::


The snippet below dispatches the `click` event on the element. Regardless of the visibility state of the element, `click` is dispatched. This is equivalent to calling [element.click()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click).

**Usage**

**sync**

```py
page.dispatch_event("button#submit", "click")
```

**async**

```py
await page.dispatch_event("button#submit", "click")
```

Under the hood, it creates an instance of an event based on the given [type](/api/class-page.mdx#page-dispatch-event-option-type), initializes it with [event_init](/api/class-page.mdx#page-dispatch-event-option-event-init) properties and dispatches it on the element. Events are `composed`, `cancelable` and bubble by default.

Since [event_init](/api/class-page.mdx#page-dispatch-event-option-event-init) is event-specific, please refer to the events documentation for the lists of initial properties:
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

**sync**

```py
# note you can only create data_transfer in chromium and firefox
data_transfer = page.evaluate_handle("new DataTransfer()")
page.dispatch_event("#source", "dragstart", { "dataTransfer": data_transfer })
```

**async**

```py
# note you can only create data_transfer in chromium and firefox
data_transfer = await page.evaluate_handle("new DataTransfer()")
await page.dispatch_event("#source", "dragstart", { "dataTransfer": data_transfer })
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `type` str
  
  DOM event type: `"click"`, `"dragstart"`, etc.
- `event_init` EvaluationArgument *(optional)*
  
  Optional event-specific initialization properties.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- NoneType

---

### eval_on_selector {/* #page-eval-on-selector */}



:::warningDiscouraged

This method does not wait for the element to pass actionability checks and therefore can lead to the flaky tests. Use [locator.evaluate()](/api/class-locator.mdx#locator-evaluate), other Locator helper methods or web-first assertions instead.

:::


The method finds an element matching the specified selector within the page and passes it as a first argument to [expression](/api/class-page.mdx#page-eval-on-selector-option-expression). If no elements match the selector, the method throws an error. Returns the value of [expression](/api/class-page.mdx#page-eval-on-selector-option-expression).

If [expression](/api/class-page.mdx#page-eval-on-selector-option-expression) returns a Promise, then [page.eval_on_selector()](/api/class-page.mdx#page-eval-on-selector) would wait for the promise to resolve and return its value.

**Usage**

**sync**

```py
search_value = page.eval_on_selector("#search", "el => el.value")
preload_href = page.eval_on_selector("linkrel=preload", "el => el.href")
html = page.eval_on_selector(".main-container", "(e, suffix) => e.outer_html + suffix", "hello")
```

**async**

```py
search_value = await page.eval_on_selector("#search", "el => el.value")
preload_href = await page.eval_on_selector("linkrel=preload", "el => el.href")
html = await page.eval_on_selector(".main-container", "(e, suffix) => e.outer_html + suffix", "hello")
```

**Arguments**
- `selector` str
  
  A selector to query for.
- `expression` str
  
  JavaScript expression to be evaluated in the browser context. If the expression evaluates to a function, the function is automatically invoked.
- `arg` EvaluationArgument *(optional)*
  
  Optional argument to pass to [expression](/api/class-page.mdx#page-eval-on-selector-option-expression).
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.

**Returns**
- Dict

---

### eval_on_selector_all {/* #page-eval-on-selector-all */}



:::warningDiscouraged

In most cases, [locator.evaluate_all()](/api/class-locator.mdx#locator-evaluate-all), other Locator helper methods and web-first assertions do a better job.

:::


The method finds all elements matching the specified selector within the page and passes an array of matched elements as a first argument to [expression](/api/class-page.mdx#page-eval-on-selector-all-option-expression). Returns the result of [expression](/api/class-page.mdx#page-eval-on-selector-all-option-expression) invocation.

If [expression](/api/class-page.mdx#page-eval-on-selector-all-option-expression) returns a Promise, then [page.eval_on_selector_all()](/api/class-page.mdx#page-eval-on-selector-all) would wait for the promise to resolve and return its value.

**Usage**

**sync**

```py
div_counts = page.eval_on_selector_all("div", "(divs, min) => divs.length >= min", 10)
```

**async**

```py
div_counts = await page.eval_on_selector_all("div", "(divs, min) => divs.length >= min", 10)
```

**Arguments**
- `selector` str
  
  A selector to query for.
- `expression` str
  
  JavaScript expression to be evaluated in the browser context. If the expression evaluates to a function, the function is automatically invoked.
- `arg` EvaluationArgument *(optional)*
  
  Optional argument to pass to [expression](/api/class-page.mdx#page-eval-on-selector-all-option-expression).

**Returns**
- Dict

---

### expect_navigation {/* #page-wait-for-navigation */}



:::warningDeprecated

This method is inherently racy, please use [page.wait_for_url()](/api/class-page.mdx#page-wait-for-url) instead.

:::


Waits for the main frame navigation and returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the last redirect. In case of navigation to a different anchor or navigation due to History API usage, the navigation will resolve with `null`.

**Usage**

This resolves when the page navigates to a new URL or reloads. It is useful for when you run code which will indirectly cause the page to navigate. e.g. The click target has an `onclick` handler that triggers navigation from a `setTimeout`. Consider this example:

**sync**

```py
with page.expect_navigation():
    # This action triggers the navigation after a timeout.
    page.get_by_text("Navigate after timeout").click()
# Resolves after navigation has finished
```

**async**

```py
async with page.expect_navigation():
    # This action triggers the navigation after a timeout.
    await page.get_by_text("Navigate after timeout").click()
# Resolves after navigation has finished
```

:::note

Usage of the [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) to change the URL is considered a navigation.
:::

**Arguments**
- `timeout` float *(optional)*
  
  Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_navigation_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-navigation-timeout), [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout), [page.set_default_navigation_timeout()](/api/class-page.mdx#page-set-default-navigation-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.
- `url` str | Pattern | Callable\[URL\]:bool *(optional)*
  
  A glob pattern, regex pattern, or predicate receiving URL to match while waiting for the navigation. Note that if the parameter is a string without wildcard characters, the method will wait for navigation to URL that is exactly equal to the string.
- `wait_until` "load" | "domcontentloaded" | "networkidle" | "commit" *(optional)*
  
  When to consider operation succeeded, defaults to `load`. Events can be either:
  * `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
  * `'load'` - consider operation to be finished when the `load` event is fired.
  * `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
  * `'commit'` - consider operation to be finished when network response is received and the document started loading.

**Returns**
- EventContextManager\[Response\]

---

### fill {/* #page-fill */}



:::warningDiscouraged

Use locator-based [locator.fill()](/api/class-locator.mdx#locator-fill) instead. Read more about [locators](../locators.mdx).

:::


This method waits for an element matching [selector](/api/class-page.mdx#page-fill-option-selector), waits for [actionability](../actionability.mdx) checks, focuses the element, fills it and triggers an `input` event after filling. Note that you can pass an empty string to clear the input field.

If the target element is not an `<input>`, `<textarea>` or `contenteditable` element, this method throws an error. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), the control will be filled instead.

To send fine-grained keyboard events, use [locator.press_sequentially()](/api/class-locator.mdx#locator-press-sequentially).

**Usage**

```python
page.fill(selector, value)
page.fill(selector, value, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `value` str
  
  Value to fill for the `<input>`, `<textarea>` or `contenteditable` element.
- `force` bool *(optional)* 
  
  Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
- `no_wait_after` bool *(optional)*
  
  :::warningDeprecated
  This option has no effect.
  :::
  
  
  This option has no effect.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- NoneType

---

### focus {/* #page-focus */}



:::warningDiscouraged

Use locator-based [locator.focus()](/api/class-locator.mdx#locator-focus) instead. Read more about [locators](../locators.mdx).

:::


This method fetches an element with [selector](/api/class-page.mdx#page-focus-option-selector) and focuses it. If there's no element matching [selector](/api/class-page.mdx#page-focus-option-selector), the method waits until a matching element appears in the DOM.

**Usage**

```python
page.focus(selector)
page.focus(selector, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- NoneType

---

### get_attribute {/* #page-get-attribute */}



:::warningDiscouraged

Use locator-based [locator.get_attribute()](/api/class-locator.mdx#locator-get-attribute) instead. Read more about [locators](../locators.mdx).

:::


Returns element attribute value.

**Usage**

```python
page.get_attribute(selector, name)
page.get_attribute(selector, name, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `name` str
  
  Attribute name to get the value for.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- NoneType | str

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

```python
page.hover(selector)
page.hover(selector, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `force` bool *(optional)*
  
  Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
- `modifiers` List\"Alt" | "Control" | "ControlOrMeta" | "Meta" | "Shift"\ *(optional)*
  
  Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used. "ControlOrMeta" resolves to "Control" on Windows and Linux and to "Meta" on macOS.
- `no_wait_after` bool *(optional)* 
  
  :::warningDeprecated
  This option has no effect.
  :::
  
  
  This option has no effect.
- `position` Dict *(optional)*
  - `x` float
    
    
  - `y` float
    
    
  A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
- `scroll` "auto" | "none" *(optional)* 
  
  Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.
- `trial` bool *(optional)* 
  
  When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it. Note that keyboard `modifiers` will be pressed regardless of `trial` to allow testing elements which are only visible when those keys are pressed.

**Returns**
- NoneType

---

### inner_html {/* #page-inner-html */}



:::warningDiscouraged

Use locator-based [locator.inner_html()](/api/class-locator.mdx#locator-inner-html) instead. Read more about [locators](../locators.mdx).

:::


Returns `element.innerHTML`.

**Usage**

```python
page.inner_html(selector)
page.inner_html(selector, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- str

---

### inner_text {/* #page-inner-text */}



:::warningDiscouraged

Use locator-based [locator.inner_text()](/api/class-locator.mdx#locator-inner-text) instead. Read more about [locators](../locators.mdx).

:::


Returns `element.innerText`.

**Usage**

```python
page.inner_text(selector)
page.inner_text(selector, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- str

---

### input_value {/* #page-input-value */}



:::warningDiscouraged

Use locator-based [locator.input_value()](/api/class-locator.mdx#locator-input-value) instead. Read more about [locators](../locators.mdx).

:::


Returns `input.value` for the selected `<input>` or `<textarea>` or `<select>` element.

Throws for non-input elements. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), returns the value of the control.

**Usage**

```python
page.input_value(selector)
page.input_value(selector, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- str

---

### is_checked {/* #page-is-checked */}



:::warningDiscouraged

Use locator-based [locator.is_checked()](/api/class-locator.mdx#locator-is-checked) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is checked. Throws if the element is not a checkbox or radio input.

**Usage**

```python
page.is_checked(selector)
page.is_checked(selector, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- bool

---

### is_disabled {/* #page-is-disabled */}



:::warningDiscouraged

Use locator-based [locator.is_disabled()](/api/class-locator.mdx#locator-is-disabled) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is disabled, the opposite of [enabled](../actionability.mdx#enabled).

**Usage**

```python
page.is_disabled(selector)
page.is_disabled(selector, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- bool

---

### is_editable {/* #page-is-editable */}



:::warningDiscouraged

Use locator-based [locator.is_editable()](/api/class-locator.mdx#locator-is-editable) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is [editable](../actionability.mdx#editable).

**Usage**

```python
page.is_editable(selector)
page.is_editable(selector, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- bool

---

### is_enabled {/* #page-is-enabled */}



:::warningDiscouraged

Use locator-based [locator.is_enabled()](/api/class-locator.mdx#locator-is-enabled) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is [enabled](../actionability.mdx#enabled).

**Usage**

```python
page.is_enabled(selector)
page.is_enabled(selector, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- bool

---

### is_hidden {/* #page-is-hidden */}



:::warningDiscouraged

Use locator-based [locator.is_hidden()](/api/class-locator.mdx#locator-is-hidden) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is hidden, the opposite of [visible](../actionability.mdx#visible).  [selector](/api/class-page.mdx#page-is-hidden-option-selector) that does not match any elements is considered hidden.

**Usage**

```python
page.is_hidden(selector)
page.is_hidden(selector, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  :::warningDeprecated
  This option is ignored. [page.is_hidden()](/api/class-page.mdx#page-is-hidden) does not wait for the element to become hidden and returns immediately.
  :::
  

**Returns**
- bool

---

### is_visible {/* #page-is-visible */}



:::warningDiscouraged

Use locator-based [locator.is_visible()](/api/class-locator.mdx#locator-is-visible) instead. Read more about [locators](../locators.mdx).

:::


Returns whether the element is [visible](../actionability.mdx#visible). [selector](/api/class-page.mdx#page-is-visible-option-selector) that does not match any elements is considered not visible.

**Usage**

```python
page.is_visible(selector)
page.is_visible(selector, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  :::warningDeprecated
  This option is ignored. [page.is_visible()](/api/class-page.mdx#page-is-visible) does not wait for the element to become visible and returns immediately.
  :::
  

**Returns**
- bool

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

**sync**

```py
page = browser.new_page()
page.goto("https://keycode.info")
page.press("body", "A")
page.screenshot(path="a.png")
page.press("body", "ArrowLeft")
page.screenshot(path="arrow_left.png")
page.press("body", "Shift+O")
page.screenshot(path="o.png")
browser.close()
```

**async**

```py
page = await browser.new_page()
await page.goto("https://keycode.info")
await page.press("body", "A")
await page.screenshot(path="a.png")
await page.press("body", "ArrowLeft")
await page.screenshot(path="arrow_left.png")
await page.press("body", "Shift+O")
await page.screenshot(path="o.png")
await browser.close()
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `key` str
  
  Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.
- `delay` float *(optional)*
  
  Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.
- `no_wait_after` bool *(optional)*
  
  :::warningDeprecated
  This option will default to `true` in the future.
  :::
  
  
  Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- NoneType

---

### query_selector {/* #page-query-selector */}



:::warningDiscouraged

Use locator-based [page.locator()](/api/class-page.mdx#page-locator) instead. Read more about [locators](../locators.mdx).

:::


The method finds an element matching the specified selector within the page. If no elements match the selector, the return value resolves to `null`. To wait for an element on the page, use [locator.wait_for()](/api/class-locator.mdx#locator-wait-for).

**Usage**

```python
page.query_selector(selector)
page.query_selector(selector, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to query for.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.

**Returns**
- NoneType | ElementHandle

---

### query_selector_all {/* #page-query-selector-all */}



:::warningDiscouraged

Use locator-based [page.locator()](/api/class-page.mdx#page-locator) instead. Read more about [locators](../locators.mdx).

:::


The method finds all elements matching the specified selector within the page. If no elements match the selector, the return value resolves to `[]`.

**Usage**

```python
page.query_selector_all(selector)
```

**Arguments**
- `selector` str
  
  A selector to query for.

**Returns**
- List\[ElementHandle\]

---

### select_option {/* #page-select-option */}



:::warningDiscouraged

Use locator-based [locator.select_option()](/api/class-locator.mdx#locator-select-option) instead. Read more about [locators](../locators.mdx).

:::


This method waits for an element matching [selector](/api/class-page.mdx#page-select-option-option-selector), waits for [actionability](../actionability.mdx) checks, waits until all specified options are present in the `<select>` element and selects these options.

If the target element is not a `<select>` element, this method throws an error. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), the control will be used instead.

Returns the array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected.

**Usage**

**sync**

```py
# Single selection matching the value or label
page.select_option("select#colors", "blue")
# single selection matching both the label
page.select_option("select#colors", label="blue")
# multiple selection
page.select_option("select#colors", value="red", "green", "blue")
```

**async**

```py
# Single selection matching the value or label
await page.select_option("select#colors", "blue")
# single selection matching the label
await page.select_option("select#colors", label="blue")
# multiple selection
await page.select_option("select#colors", value="red", "green", "blue")
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `force` bool *(optional)* 
  
  Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
- `no_wait_after` bool *(optional)*
  
  :::warningDeprecated
  This option has no effect.
  :::
  
  
  This option has no effect.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.
- `element` ElementHandle | List\[ElementHandle\] *(optional)*
  
  Option elements to select. Optional.
- `index` int | List\[int\] *(optional)*
  
  Options to select by index. Optional.
- `value` str | List\[str\] *(optional)*
  
  Options to select by value. If the `<select>` has the `multiple` attribute, all given options are selected, otherwise only the first option matching one of the passed options is selected. Optional.
- `label` str | List\[str\] *(optional)*
  
  Options to select by label. If the `<select>` has the `multiple` attribute, all given options are selected, otherwise only the first option matching one of the passed options is selected. Optional.

**Returns**
- List\[str\]

---

### set_checked {/* #page-set-checked */}



:::warningDiscouraged

Use locator-based [locator.set_checked()](/api/class-locator.mdx#locator-set-checked) instead. Read more about [locators](../locators.mdx).

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

```python
page.set_checked(selector, checked)
page.set_checked(selector, checked, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `checked` bool
  
  Whether to check or uncheck the checkbox.
- `force` bool *(optional)*
  
  Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
- `no_wait_after` bool *(optional)*
  
  :::warningDeprecated
  This option has no effect.
  :::
  
  
  This option has no effect.
- `position` Dict *(optional)*
  - `x` float
    
    
  - `y` float
    
    
  A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
- `scroll` "auto" | "none" *(optional)* 
  
  Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
- `strict` bool *(optional)*
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.
- `trial` bool *(optional)*
  
  When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it.

**Returns**
- NoneType

---

### set_input_files {/* #page-set-input-files */}



:::warningDiscouraged

Use locator-based [locator.set_input_files()](/api/class-locator.mdx#locator-set-input-files) instead. Read more about [locators](../locators.mdx).

:::


Sets the value of the file input to these file paths or files. If some of the `filePaths` are relative paths, then they are resolved relative to the current working directory. For empty array, clears the selected files. For inputs with a `webkitdirectory` attribute, only a single directory path is supported.

This method expects [selector](/api/class-page.mdx#page-set-input-files-option-selector) to point to an [input element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input). However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), targets the control instead.

**Usage**

```python
page.set_input_files(selector, files)
page.set_input_files(selector, files, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `files` Union\[str, pathlib.Path\] | List\[Union\[str, pathlib.Path\]\] | Dict | List\[Dict\]
  - `name` str
    
    File name
  - `mimeType` str
    
    File type
  - `buffer` bytes
    
    File content
- `no_wait_after` bool *(optional)*
  
  :::warningDeprecated
  This option has no effect.
  :::
  
  
  This option has no effect.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- NoneType

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

[page.tap()](/api/class-page.mdx#page-tap) will throw if the [has_touch](/api/class-browser.mdx#browser-new-context-option-has-touch) option of the browser context is false.
:::

**Usage**

```python
page.tap(selector)
page.tap(selector, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `force` bool *(optional)*
  
  Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
- `modifiers` List\"Alt" | "Control" | "ControlOrMeta" | "Meta" | "Shift"\ *(optional)*
  
  Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used. "ControlOrMeta" resolves to "Control" on Windows and Linux and to "Meta" on macOS.
- `no_wait_after` bool *(optional)*
  
  :::warningDeprecated
  This option has no effect.
  :::
  
  
  This option has no effect.
- `position` Dict *(optional)*
  - `x` float
    
    
  - `y` float
    
    
  A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
- `scroll` "auto" | "none" *(optional)* 
  
  Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.
- `trial` bool *(optional)* 
  
  When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it. Note that keyboard `modifiers` will be pressed regardless of `trial` to allow testing elements which are only visible when those keys are pressed.

**Returns**
- NoneType

---

### text_content {/* #page-text-content */}



:::warningDiscouraged

Use locator-based [locator.text_content()](/api/class-locator.mdx#locator-text-content) instead. Read more about [locators](../locators.mdx).

:::


Returns `element.textContent`.

**Usage**

```python
page.text_content(selector)
page.text_content(selector, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- NoneType | str

---

### type {/* #page-type */}



:::warningDeprecated

In most cases, you should use [locator.fill()](/api/class-locator.mdx#locator-fill) instead. You only need to press keys one by one if there is special keyboard handling on the page - in this case use [locator.press_sequentially()](/api/class-locator.mdx#locator-press-sequentially).

:::


Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text. `page.type` can be used to send fine-grained keyboard events. To fill values in form fields, use [page.fill()](/api/class-page.mdx#page-fill).

To press a special key, like `Control` or `ArrowDown`, use [keyboard.press()](/api/class-keyboard.mdx#keyboard-press).

**Usage**

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `text` str
  
  A text to type into a focused element.
- `delay` float *(optional)*
  
  Time to wait between key presses in milliseconds. Defaults to 0.
- `no_wait_after` bool *(optional)*
  
  :::warningDeprecated
  This option has no effect.
  :::
  
  
  This option has no effect.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- NoneType

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

```python
page.uncheck(selector)
page.uncheck(selector, **kwargs)
```

**Arguments**
- `selector` str
  
  A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.
- `force` bool *(optional)*
  
  Whether to bypass the [actionability](../actionability.mdx) checks. Defaults to `false`.
- `no_wait_after` bool *(optional)*
  
  :::warningDeprecated
  This option has no effect.
  :::
  
  
  This option has no effect.
- `position` Dict *(optional)* 
  - `x` float
    
    
  - `y` float
    
    
  A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
- `scroll` "auto" | "none" *(optional)* 
  
  Controls whether Playwright scrolls the element into view before performing the action. Defaults to `"auto"`, which scrolls the element into view when necessary, including scrolling nested scrollable containers. When set to `"none"`, Playwright does not scroll the element and the action fails if the element is not already in the viewport. This is useful to assert that an element is reachable by the user without additional scrolling.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.
- `trial` bool *(optional)* 
  
  When set, this method only performs the [actionability](../actionability.mdx) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it.

**Returns**
- NoneType

---

### wait_for_selector {/* #page-wait-for-selector */}



:::warningDiscouraged

Use web assertions that assert visibility or a locator-based [locator.wait_for()](/api/class-locator.mdx#locator-wait-for) instead. Read more about [locators](../locators.mdx).

:::


Returns when element specified by selector satisfies [state](/api/class-page.mdx#page-wait-for-selector-option-state) option. Returns `null` if waiting for `hidden` or `detached`.

:::note

Playwright automatically waits for element to be ready before performing an action. Using Locator objects and web-first assertions makes the code wait-for-selector-free.
:::

Wait for the [selector](/api/class-page.mdx#page-wait-for-selector-option-selector) to satisfy [state](/api/class-page.mdx#page-wait-for-selector-option-state) option (either appear/disappear from dom, or become visible/hidden). If at the moment of calling the method [selector](/api/class-page.mdx#page-wait-for-selector-option-selector) already satisfies the condition, the method will return immediately. If the selector doesn't satisfy the condition for the [timeout](/api/class-page.mdx#page-wait-for-selector-option-timeout) milliseconds, the function will throw.

**Usage**

This method works across navigations:

**sync**

```py
from playwright.sync_api import sync_playwright, Playwright

def run(playwright: Playwright):
    chromium = playwright.chromium
    browser = chromium.launch()
    page = browser.new_page()
    for current_url in "https://google.com", "https://bbc.com":
        page.goto(current_url, wait_until="domcontentloaded")
        element = page.wait_for_selector("img")
        print("Loaded image: " + str(element.get_attribute("src")))
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
```

**async**

```py
import asyncio
from playwright.async_api import async_playwright, Playwright

async def run(playwright: Playwright):
    chromium = playwright.chromium
    browser = await chromium.launch()
    page = await browser.new_page()
    for current_url in "https://google.com", "https://bbc.com":
        await page.goto(current_url, wait_until="domcontentloaded")
        element = await page.wait_for_selector("img")
        print("Loaded image: " + str(await element.get_attribute("src")))
    await browser.close()

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())
```

**Arguments**
- `selector` str
  
  A selector to query for.
- `state` "attached" | "detached" | "visible" | "hidden" *(optional)*
  
  Defaults to `'visible'`. Can be either:
  * `'attached'` - wait for element to be present in DOM.
  * `'detached'` - wait for element to not be present in DOM.
  * `'visible'` - wait for element to have non-empty bounding box and no `visibility:hidden`. Note that element without any content or with `display:none` has an empty bounding box and is not considered visible.
  * `'hidden'` - wait for element to be either detached from DOM, or have an empty bounding box or `visibility:hidden`. This is opposite to the `'visible'` option.
- `strict` bool *(optional)* 
  
  When true, the call requires selector to resolve to a single element. If given selector resolves to more than one element, the call throws an exception.
- `timeout` float *(optional)*
  
  Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browser_context.set_default_timeout()](/api/class-browsercontext.mdx#browser-context-set-default-timeout) or [page.set_default_timeout()](/api/class-page.mdx#page-set-default-timeout) methods.

**Returns**
- NoneType | ElementHandle

---

### wait_for_timeout {/* #page-wait-for-timeout */}



:::warningDiscouraged

Never wait for timeout in production. Tests that wait for time are inherently flaky. Use Locator actions and web assertions that wait automatically.

:::


Waits for the given [timeout](/api/class-page.mdx#page-wait-for-timeout-option-timeout) in milliseconds.

Note that `page.waitForTimeout()` should only be used for debugging. Tests using the timer in production are going to be flaky. Use signals such as network events, selectors becoming visible and others instead.

**Usage**

**sync**

```py
# wait for 1 second
page.wait_for_timeout(1000)
```

**async**

```py
# wait for 1 second
await page.wait_for_timeout(1000)
```

**Arguments**
- `timeout` float
  
  A timeout to wait for

**Returns**
- NoneType


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
Error: /api/class-error.mdx "Error"
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

Any: https://docs.python.org/3/library/typing.html#typing.Any "Any"
bool: https://docs.python.org/3/library/stdtypes.html "bool"
bytes: https://docs.python.org/3/library/stdtypes.html#bytes "bytes"
Callable: https://docs.python.org/3/library/typing.html#typing.Callable "Callable"
EventContextManager: https://docs.python.org/3/reference/datamodel.html#context-managers "Event context manager"
EventEmitter: https://pyee.readthedocs.io/en/latest/#pyee.BaseEventEmitter "EventEmitter"
Exception: https://docs.python.org/3/library/exceptions.html#Exception "Exception"
Dict: https://docs.python.org/3/library/typing.html#typing.Dict "Dict"
float: https://docs.python.org/3/library/stdtypes.html#numeric-types-int-float-complex "float"
int: https://docs.python.org/3/library/stdtypes.html#numeric-types-int-float-complex "int"
List: https://docs.python.org/3/library/typing.html#typing.List "List"
NoneType: https://docs.python.org/3/library/constants.html#None "None"
Pattern: https://docs.python.org/3/library/re.html "Pattern"
URL: https://en.wikipedia.org/wiki/URL "URL"
pathlib.Path: https://realpython.com/python-pathlib/ "pathlib.Path"
str: https://docs.python.org/3/library/stdtypes.html#text-sequence-type-str "str"
Union: https://docs.python.org/3/library/typing.html#typing.Union "Union"
datetime: https://docs.python.org/3/library/datetime.html#datetime.datetime "datetime"

all available image tags: https://mcr.microsoft.com/en-us/product/playwright/python/about "all available image tags"
Microsoft Artifact Registry: https://mcr.microsoft.com/en-us/product/playwright/python/about "Microsoft Artifact Registry"
Dockerfile.noble: https://github.com/microsoft/playwright-python/blob/main/utils/docker/Dockerfile.noble "Dockerfile.noble"
