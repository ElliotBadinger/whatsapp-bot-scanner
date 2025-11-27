# Comprehensive Security Tickets Document

**Generated:** 2025-11-27T22:22:10.819Z
**Total Issues:** 129

This document aggregates all security findings from DeepSource and SonarQube into actionable tickets.

---

## CRITICAL Priority Issues (6)

### [DeepSource] Detected usage of the `any` type (JS-0323)

**Category:** Issue
**Description:**
The `any` type can sometimes leak into your codebase. TypeScript compiler skips the type checking of the `any` typed variables, so it creates a potential safety hole, and source of bugs in your codebase. We recommend using `unknown` or `never` type variable.

<!--more-->

In TypeScript, every type is assignable to `any`. This makes `any` a top type (also known as a universal supertype) of the type system.
The `any` type is essentially an escape hatch from the type system. As developers, this gives us a ton of freedom: TypeScript lets us perform any operation we want on values of type `any` without having to perform any checking beforehand.
The developers should not assign `any` typed value to variables and properties, which can be hard to pick up on, especially from the external library; instead, developers can use the `never` or `unknown` type variable.

### Bad Practice
```js
const age: any = 'seventeen';

const ages: any[] = ['seventeen'];

const ages: Array<any> = ['seventeen'];

function greet(): any {}

function greet(): any[] {}

function greet(): Array<any> {}

function greet(): Array<Array<any>> {}

function greet(param: Array<any>): string {}

function greet(param: Array<any>): Array<any> {}
```

### Recommended
```ts
const age: number = 17;

const ages: number[] = [17];

const ages: Array<number> = [17];

function greet(): string {}

function greet(): string[] {}

function greet(): Array<string> {}

function greet(): Array<Array<string>> {}

function greet(param: Array<string>): string {}

function greet(param: Array<string>): Array<string> {}
```

**Locations (10):**
- [ ] `tests/stubs/bottleneck.ts:9` - Unexpected any. Specify a different type
- [ ] `tests/integration/whois-quota.test.ts:26` - Unexpected any. Specify a different type
- [ ] `tests/integration/vt-throttling.test.ts:67` - Unexpected any. Specify a different type
- [ ] `tests/integration/vt-throttling.test.ts:45` - Unexpected any. Specify a different type
- [ ] `tests/integration/vt-throttling.test.ts:40` - Unexpected any. Specify a different type
- [ ] `tests/integration/vt-throttling.test.ts:16` - Unexpected any. Specify a different type
- [ ] `tests/integration/vt-throttling.test.ts:15` - Unexpected any. Specify a different type
- [ ] `tests/integration/vt-rate-limit.test.ts:60` - Unexpected any. Specify a different type
- [ ] `tests/integration/vt-rate-limit.test.ts:36` - Unexpected any. Specify a different type
- [ ] `tests/integration/vt-rate-limit.test.ts:31` - Unexpected any. Specify a different type

---

### [DeepSource] Audit: Unsanitized user input passed to server logs (JS-A1004)

**Category:** Issue
**Description:**
Logs serve as important records that are used by monitoring services and developers to investigate incidents.
Logging unsanitized user input to the server allows the user to forge custom server logs.

In some more serious scenarios, it opens the application up to attacks like [spoofing](https://en.wikipedia.org/wiki/Spoofing_attack).
The attacker may insert a line break in the request object, and make the second line of their log look like a log from a different user, or an info message displayed by the server.

### Bad Practice

```js
import http from "http"
import url from "url"

http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true)
  // Vulnerable! user can inject special characters in the terminal
  console.log(parsedUrl.query.username);
})
```

### Recommended

```js
import http from "http"
import url from "url"

http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true)

  // NOTE: Ideally, stronger sanitization functions should be used.
  // String#replace is only used as an example.
  const username = parsedUrl.query.username.replace(/\n|\r/g, "")
  console.log(parsedUrl.username);
})
```

## References
- [OWASP: Log injection](https://owasp.org/www-community/attacks/Log_Injection)
- [OWASP A09:2021 - Security Logging and Monitoring Failures](https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/)
- [OWASP A10:2017 - Insufficient Logging & Monitoring](https://owasp.org/www-project-top-ten/2017/A10_2017-Insufficient_Logging%2526Monitoring)
- [CWE-117: Improper Output Neutralization for Logs](https://cwe.mitre.org/data/definitions/117.html)

**Locations (1):**
- [ ] `scripts/export-wwebjs-docs.mjs:70` - Sanitize input before logging to console

---

### [DeepSource] Invalid variable usage (JS-0043)

**Category:** Issue
**Description:**
Variables should be used inside of their binding context.
This helps avoid difficult bugs with variable hoisting.
It is a bad practice to use `var` declarations because variables declared using `var` can be accessed in a function-wide scope.
They can even be accessed before declaration.
In such cases, their value would be `undefined` because only declarations and not initializations are hoisted.

### Bad Practice

```js
function doIf() {
    if (cond()) {
        var build = true;
    }
    console.log(build);
}

function doIfElse() {
    if (cond()) {
        var build = true;
    } else {
        var build = false;
    }
    console.log(build)
}
```

### Recommended

```js
function doIf() {
    let build;
    if (cond()) {
        build = true;
    }
    console.log(build);
}
```

**Locations (10):**
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:212` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:197` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:191` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:188` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:184` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:177` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:171` - 'unzipper' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:169` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:151` - 'fs' used outside of binding context
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:149` - 'fs' used outside of binding context

---

### [DeepSource] Found the usage of undeclared variables (JS-0125)

**Category:** Issue
**Description:**
Variables that aren't defined, but accessed may throw reference errors at runtime.

> **NOTE**: In browser applications, DeepSource recommends the use of ESModules over regular `text/javascript` scripts.
> Using variables that are injected by scripts included in an HTML file is currently not supported.

<!--more-->

Potential `ReferenceError`s may result from misspellings of variable and parameter names, or accidental implicit globals (for example, forgetting the `var` keyword in a `for` loop initializer).
Any reference to an undeclared variable causes a warning, unless the variable is explicitly mentioned in a `/*global ...*/` comment, or specified in the globals key in the configuration file.
A common use case for these is if you intentionally use globals that are defined elsewhere (e.g. in a script sourced from HTML).

### Bad Practice

```js
const foo = someFunction(); // `someFunction` is not defined
const bar = baz + 1; // 'baz' is undeclared
```

### Recommended

```js
import { someFunction } from 'some-file';

const baz = Math.random();
const foo = someFunction();
const bar = baz + 1;
```

**Locations (9):**
- [ ] `whatsapp-web.js/docs/scripts/jsdoc-toc.js:17` - 'jQuery' is not defined To fix this, add jquery in `environment` array of  `.deepsource.toml`. Read more in our documentation https://deepsource.io/docs/analyzer/javascript
- [ ] `scripts/setup/orchestrator.mjs:930` - 'Confirm' is not defined
- [ ] `scripts/setup/orchestrator.mjs:890` - 'Confirm' is not defined
- [ ] `scripts/jest-env-setup.js:31` - 'jest' is not defined To fix this, add jest in `environment` array of  `.deepsource.toml`. Read more in our documentation https://deepsource.io/docs/analyzer/javascript
- [ ] `scripts/jest-env-setup.js:29` - 'jest' is not defined To fix this, add jest in `environment` array of  `.deepsource.toml`. Read more in our documentation https://deepsource.io/docs/analyzer/javascript
- [ ] `scripts/jest-env-setup.js:27` - 'jest' is not defined To fix this, add jest in `environment` array of  `.deepsource.toml`. Read more in our documentation https://deepsource.io/docs/analyzer/javascript
- [ ] `scripts/jest-env-setup.js:26` - 'jest' is not defined To fix this, add jest in `environment` array of  `.deepsource.toml`. Read more in our documentation https://deepsource.io/docs/analyzer/javascript
- [ ] `scripts/jest-env-setup.js:25` - 'jest' is not defined To fix this, add jest in `environment` array of  `.deepsource.toml`. Read more in our documentation https://deepsource.io/docs/analyzer/javascript
- [ ] `scripts/jest-env-setup.js:16` - 'jest' is not defined To fix this, add jest in `environment` array of  `.deepsource.toml`. Read more in our documentation https://deepsource.io/docs/analyzer/javascript

---

### [SonarQube] Enable server hostname verification on this SSL/TLS connection. (typescript:S5527)

**Category:** Vulnerability
**Description:**
Enable server hostname verification on this SSL/TLS connection.

**Locations (1):**
- [ ] `packages/shared/src/reputation/certificate-intelligence.ts:72` - Enable server hostname verification on this SSL/TLS connection.

---

### [SonarQube] Enable server certificate validation on this SSL/TLS connection. (typescript:S4830)

**Category:** Vulnerability
**Description:**
Enable server certificate validation on this SSL/TLS connection.

**Locations (1):**
- [ ] `packages/shared/src/reputation/certificate-intelligence.ts:72` - Enable server certificate validation on this SSL/TLS connection.

---

## HIGH Priority Issues (1)

### [SonarQube] Make sure that executing SQL queries is safe here. (typescript:S2077)

**Category:** Security Hotspot
**Description:**
Make sure that executing SQL queries is safe here.

**Locations (1):**
- [ ] `services/control-plane/src/index.ts:287` - Make sure that executing SQL queries is safe here.

---

## MAJOR Priority Issues (22)

### [DeepSource] Found explicit type declarations (JS-0331)

**Category:** Issue
**Description:**
Explicit types where they can be easily inferred may add unnecessary verbosity for variables or parameters initialized to a number, string, or boolean

### Bad Practice
```ts
const a: bigint = 10n;
const a: bigint = -10n;
const a: bigint = BigInt(10);
const a: bigint = -BigInt(10);
const a: boolean = false;
const a: boolean = true;
const a: boolean = Boolean(null);
const a: boolean = !0;
const a: number = -10;
const a: number = Number('1');
const a: number = +Number('1');
const a: number = -Number('1');
const a: null = null;
const a: RegExp = /a/;
const a: RegExp = RegExp('a');
const a: RegExp = new RegExp('a');
const a: string = 'str';
const a: string = String(1);
const a: symbol = Symbol('a');
const a: undefined = void someValue;

class Foo {
  prop: number = 5;
}

function fn(a: number = 5, b: boolean = true) {}
```

### Recommended
```ts
const a = 10n;
const a = -10n;
const a = BigInt(10);
const a = -BigInt(10);
const a = false;
const a = true;
const a = Boolean(null);
const a = !0;
const a = 10;
const a = +10;
const a = -Number('1');
const a = null;
const a = /a/;
const a = RegExp('a');
const a = 'str';
const a = String(1);
const a = Symbol('a');
const a = void someValue;

class Foo {
  prop = 5;
}

function fn(a = 5, b = true) {}

function fn(a: number, b: boolean, c: string) {}
```

**Autofix Available:** Yes

**Locations (2):**
- [ ] `packages/shared/src/reputation/dns-intelligence.ts:184` - Type number trivially inferred from a number literal, remove type annotation
- [ ] `packages/shared/src/circuit-breaker.ts:19` - Type number trivially inferred from a number literal, remove type annotation

---

### [DeepSource] Suggest correct usage of shebang (JS-0271)

**Category:** Issue
**Description:**
The issue checks for incorrect or missing shebang in files mentioned in the `bin` field of the `package.json`.
When creating a CLI tool with Node.js, it is necessary to add a shebang to the file that serves as the entry point for the application.
As the NPM docs say, the file(s) referenced in `bin` must start with `#!/usr/bin/env node`, or the scripts won't be run with the Node.js executable.

<!--more-->
The `bin` field in package.json is used to specify JS files which run as tools when launched with the Node.js launcher.

### Bad Practice

Incorrect shebang:

```js
// /user/bin/env node
console.log("App launched");
```

No shebang in a file referenced in package.json's `bin` field:

```js
console.log("App launched")
```

### Recommended

The following code snippet is assumed to be in a file that is referenced in the `bin` field:

```js
#!/usr/bin/env node
console.log("App launched");
```

## References

- [`bin` - npm](https://docs.npmjs.com/cli/v7/configuring-npm/package-json#bin)
- [shebang](https://en.wikipedia.org/wiki/Shebang_(Unix))

**Autofix Available:** Yes

**Locations (7):**
- [ ] `tests/load/http-load.js:12` - This file needs no shebang
- [ ] `scripts/watch-pairing-code.js:8` - This file needs no shebang
- [ ] `scripts/validate-config.js:2` - This file needs no shebang
- [ ] `scripts/setup-wizard.mjs:3` - This file needs no shebang
- [ ] `scripts/run-seeds.js:2` - This file needs no shebang
- [ ] `scripts/run-migrations.js:2` - This file needs no shebang
- [ ] `scripts/deepsource-api.js:20` - This file needs no shebang

---

### [DeepSource] Consider decorating method with `@staticmethod` (PYL-R0201)

**Category:** Issue
**Description:**
The method doesn't use its bound instance. Decorate this method with `@staticmethod` decorator, so that Python does not have to instantiate a bound method for every instance of this class thereby saving memory and computation. Read more about staticmethods [here](https://docs.python.org/3/library/functions.html#staticmethod).

**Autofix Available:** Yes

**Locations (7):**
- [ ] `scripts/agent_orchestrator/tests/test_orchestrator.py:109` - Method doesn't use the class instance and could be converted into a static method
- [ ] `scripts/agent_orchestrator/tests/test_orchestrator.py:106` - Method doesn't use the class instance and could be converted into a static method
- [ ] `scripts/agent_orchestrator/tests/test_orchestrator.py:101` - Method doesn't use the class instance and could be converted into a static method
- [ ] `scripts/agent_orchestrator/tests/test_orchestrator.py:98` - Method doesn't use the class instance and could be converted into a static method
- [ ] `scripts/agent_orchestrator/tests/test_orchestrator.py:95` - Method doesn't use the class instance and could be converted into a static method
- [ ] `scripts/agent_orchestrator/tests/test_orchestrator.py:92` - Method doesn't use the class instance and could be converted into a static method
- [ ] `scripts/agent_orchestrator/main.py:182` - Method doesn't use the class instance and could be converted into a static method

---

### [DeepSource] Unnecessary `delete` statement in a local scope (PTC-W0043)

**Category:** Issue
**Description:**
Passing a local variable to a `del` statement results in that variable being removed from the local namespace.
When exiting a function all local variables are deleted, so it is unnecessary to explicitly delete variables in such cases.

It is recommended to remove this `del` statement.

Not preferred:
```python
def my_func():
    task = do_some_task()
    evaluate_task(task)
    del task  # This is unnecessary.
```

Preferred:
```python
def my_func():
    task = do_some_task()
    evaluate_task(task)
```

**Autofix Available:** Yes

**Locations (2):**
- [ ] `scripts/agent_orchestrator/cli_agents.py:108` - Unnecessary `del` statement in a local scope
- [ ] `scripts/agent_orchestrator/cli_agents.py:62` - Unnecessary `del` statement in a local scope

---

### [DeepSource] Found duplicate module imports (JS-0232)

**Category:** Issue
**Description:**
Using a single `import` statement per module will make the code clearer because you can see everything being imported from that module on one line.

In the following example the `module` import on line 1 is repeated on line 3. These can be combined to make the list of imports more succinct.
```
import { merge } from 'module';
import something from 'another-module';
import { find } from 'module';
```

### Bad Practice

```js
import { merge } from 'module';
import something from 'another-module';
import { find } from 'module';
```

### Recommended

```js
import { merge, find } from 'module';
import something from 'another-module';
```

**Locations (1):**
- [ ] `scripts/setup/orchestrator.mjs:178` - './ui/hotkeys.mjs' import is duplicated

---

### [DeepSource] Consider using `let` or `const` instead of `var` (JS-0239)

**Category:** Issue
**Description:**
It is recommended to use `let` or `const` over `var`.
This will help prevent re-declaration of variables that are in the global scope when using `var`.

<!--more-->

ES6 allows programmers to create variables with block scope instead of function scope using the `let` and `const` keywords.
Block scope is common in many other programming languages and helps programmers avoid mistakes such as this one:

```js
var count = people.length;
var enoughFood = count > sandwiches.length;

if (enoughFood) {
    var count = sandwiches.length; // accidentally overriding the count variable
    console.log("We have " + count + " sandwiches for everyone. Plenty for all!");
}

// our count variable is no longer accurate
console.log("We have " + count + " people and " + sandwiches.length + " sandwiches!");
```

Block scoped variables shadow outer declarations instead of writing to them.

**NOTE:**
There are certain edge cases where users might want to consider var.
Consider this example:

```js
var lib = lib || { run: () => {} }
```

Here, `lib` might be a library that is exposed to an HTML file using a `<script>` tag.
The `var` keyword helps avoid re-writing `lib` if it has already been declared via an injected script that was executed before this one.
Ideally, you should let bundlers worry about cases like this.
But if you want to use `var` anyway, consider using a [skipcq comment](https://docs.deepsource.com/docs/issues-ignore-rules), or [disabling the issue](https://docs.deepsource.com/docs/repository-view-issues#ignoring-issues) altogether.

### Bad Practice

```js
var x = "y";
var CONFIG = {};
```

### Recommended
```js
let x = "y";
const CONFIG = {};
```

**Locations (10):**
- [ ] `whatsapp-web.js/src/util/Util.js:23` - Unexpected var, use let or const instead
- [ ] `whatsapp-web.js/src/util/Util.js:22` - Unexpected var, use let or const instead
- [ ] `whatsapp-web.js/src/util/Util.js:21` - Unexpected var, use let or const instead
- [ ] `whatsapp-web.js/src/util/Util.js:20` - Unexpected var, use let or const instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:714` - Unexpected var, use let or const instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:713` - Unexpected var, use let or const instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:712` - Unexpected var, use let or const instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:711` - Unexpected var, use let or const instead
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:169` - Unexpected var, use let or const instead
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:98` - Unexpected var, use let or const instead

---

### [DeepSource] Detected the use of process.exit() (JS-0263)

**Category:** Issue
**Description:**
The process.exit() method in Node.js is used to immediately stop the Node.js process and exit. This is a dangerous operation because it can occur in any method at any point in time, potentially stopping a Node.js application completely when an error occurs. For example:
```
if (somethingBadHappened) {
    console.error("Something bad happened!");
    process.exit(1);
}
```
This code could appear in any module and will stop the entire application when somethingBadHappened is truthy. This doesn't give the application any chance to respond to the error. It's usually better to throw an error and allow the application to handle it appropriately:
```
if (somethingBadHappened) {
    throw new Error("Something bad happened!");
}
```
By throwing an error in this way, other parts of the application have an opportunity to handle the error rather than stopping the application altogether. If the error bubbles all the way up to the process without being handled, then the process will exit and a non-zero exit code will returned, so the end result is the same.

If you are using process.exit() only for specifying the exit code, you can set process.exitCode (introduced in Node.js 0.11.8) instead.

### Bad Practice

```js
process.exit(1);
process.exit(0);
```


### Recommended

```js
Process.exit();
var exit = process.exit;
```

**Locations (10):**
- [ ] `tests/load/http-load.js:103` - Don't use process.exit(); throw an error instead
- [ ] `tests/load/http-load.js:41` - Don't use process.exit(); throw an error instead
- [ ] `tests/load/http-load.js:36` - Don't use process.exit(); throw an error instead
- [ ] `services/wa-client/src/index.ts:1988` - Don't use process.exit(); throw an error instead
- [ ] `services/scan-orchestrator/src/index.ts:1519` - Don't use process.exit(); throw an error instead
- [ ] `services/scan-orchestrator/src/index.ts:1511` - Don't use process.exit(); throw an error instead
- [ ] `services/control-plane/src/index.ts:352` - Don't use process.exit(); throw an error instead
- [ ] `scripts/watch-pairing-code.js:219` - Don't use process.exit(); throw an error instead
- [ ] `scripts/watch-pairing-code.js:214` - Don't use process.exit(); throw an error instead
- [ ] `scripts/watch-pairing-code.js:159` - Don't use process.exit(); throw an error instead

---

### [DeepSource] Detected deprecated APIs (JS-0272)

**Category:** Issue
**Description:**
Since its inception, NodeJS has deprecated many APIs for one of the following reasons:
  - Use of the API is unsafe.
  - An improved version of the API was introduced later.
  - The API may have breaking changes in a future version of Node.

This issue prevents the use of deprecated Node APIs in favor of modern ones.

### Bad Practice

```js
const fs = require("fs");
function fetchData(fileName) {
  // 'fs.exists' was deprecated since v4.
  // Use 'fs.stat()' or 'fs.access()' instead.
  if (fs.exists(fileName)) {
    // ... 
  }
}
```

### Recommended

```js
async function fetchData(fileName) {
  fs.access(fileName, (error) => {
    if (error) {
      // Handle the error
    } else {
      // ...
    }
  })
}
```

**Locations (1):**
- [ ] `packages/shared/src/homoglyph.ts:2` - 'punycode' module was deprecated since v7.0.0. Use 'https://www.npmjs.com/package/punycode' instead

---

### [DeepSource] Found non-null assertions (JS-0339)

**Category:** Issue
**Description:**
Using non-null assertions cancels out the benefits of strict null-checking, and introduces the possibility of runtime errors.
Avoid non-null assertions unless absolutely necessary.
If you still need to use one, write a [skipcq comment](https://docs.deepsource.com/docs/issues-ignore-rules) to explain why it is safe.

Ideally, you want to have a validation function that confirms a value isn't null, with a return type like this:

```ts
type AccentedColor = `${Color}-${Accent}`
function isColorValid(name: string): name is AccentedColor {
  // ...
}
```

### Bad Practice

```ts
// a user named "injuly" may not exist in the DB
const injuly: User | null = db.getUserByName("injuly");

// Using the non-null assertion operator will bypass null-checking
const pfp = injuly!.profilePicture;
```

### Recommended

```ts
const injuly: User | null = db.getUserByName("injuly");
const pfp = injuly?.profilePicture; // pfp: Image | undefined

// OR:

const pfp_ = injuly ? injuly.pfp : defaultPfp; // pfp: Image
```

Alternatively:

```ts
function isUserValid(userObj: User | null | undefined ): userObj is User {
  return Boolean(userObj) && validate(userObj);
}

const injuly = db.getUserByName("injuly")
if (isUserValid(injuly)) {
  const pfp = injuly.profilePicture;
  // ...
}
```

**Locations (5):**
- [ ] `tests/e2e/message-flow.test.ts:38` - Forbidden non-null assertion
- [ ] `tests/e2e/message-flow.test.ts:21` - Forbidden non-null assertion
- [ ] `services/wa-client/src/verdictTracker.ts:63` - Forbidden non-null assertion
- [ ] `services/wa-client/src/__tests__/remoteAuthStore.test.ts:18` - Forbidden non-null assertion
- [ ] `packages/shared/src/__tests__/url.test.ts:33` - Forbidden non-null assertion

---

### [DeepSource] Found unused variables in TypeScript code (JS-0356)

**Category:** Issue
**Description:**
Unused variables are generally considered a code smell and should be avoided.

<!--more-->

Removing unused references
- It prevents unused modules from being loaded at runtime, improving performance, and preventing the compiler from loading metadata that will never be used.
- It prevents conflicts that may occur when trying to reference another variable.

**NOTE:** If you have intentionally left a variable unused, we suggest you to prefix the variable name with a `_` to prevent them from being flagged by DeepSource.

### Bad Practice
```ts
import fs from 'fs' // <- unused
import { readFileSync } from 'fs'

const text = readFileSync('declaration_of_independence.txt', 'utf-8')
console.log(text)
```

### Recommended

```ts
import { readFileSync } from 'fs'

const text = readFileSync('declaration_of_independence.txt', 'utf-8')
console.log(text)
```

**Locations (6):**
- [ ] `services/wa-client/src/index.ts:25` - 'VerdictAttemptPayload' is defined but never used
- [ ] `services/wa-client/src/__tests__/functional/session-flow.test.ts:45` - 'result' is assigned a value but never used
- [ ] `services/scan-orchestrator/src/index.ts:49` - 'WhoisXmlResponse' is defined but never used
- [ ] `services/scan-orchestrator/src/index.ts:13` - 'rateLimiterDelay' is defined but never used
- [ ] `packages/shared/src/scoring.ts:2` - 'GsbThreatMatch' is defined but never used
- [ ] `packages/shared/src/reputation/whodat.ts:22` - 'SERVICE_LABEL' is assigned a value but never used

---

### [DeepSource] Detected the use of variables before they are defined (JS-0357)

**Category:** Issue
**Description:**
Variables, functions and types should always be used *after* they've been defined.
This issue will flag any code snippets that use variables or types before definition.

<!-- more -->

Sometimes, the code will run just fine even when the variable is declared after use.
Consider the following example:

```ts
const ram: Resource = { type: "memory", limit: 1024 ** 3 }
type Resource = {
  type: string;
  limit: number;
}
```

Here, `Resource` is used in the annotation before it has been defined.
Similarly, it is possible to hoist function declarations and variables declared with the `var` keyword:

```js
const four = twice(2);
function twice(n: number) {
  return n * 2;
}
```

However, it makes the code harder to follow when variables or types are declared *after* being used.

### Bad Practice

```ts
const knight: Radiant = {
  order: "SurgeBinder"
  strength: 30
}

interface Radiant {
  order: string;
  strength: number;
}
```

### Recommended

```ts
interface Radiant {
  order: string;
  strength: number;
}

const knight: Radiant = {
  order: "SurgeBinder"
  strength: 30
}
```

**Locations (9):**
- [ ] `services/wa-client/src/index.ts:1080` - 'replayCachedQr' was used before it was defined
- [ ] `services/wa-client/src/index.ts:996` - 'replayCachedQr' was used before it was defined
- [ ] `services/wa-client/src/index.ts:954` - 'requestPairingCodeWithRetry' was used before it was defined
- [ ] `services/wa-client/src/index.ts:953` - 'pairingOrchestrator' was used before it was defined
- [ ] `services/wa-client/src/index.ts:210` - 'maskPhone' was used before it was defined
- [ ] `services/wa-client/src/index.ts:199` - 'maskPhone' was used before it was defined
- [ ] `services/wa-client/src/index.ts:189` - 'maskPhone' was used before it was defined
- [ ] `services/wa-client/src/index.ts:175` - 'maskPhone' was used before it was defined
- [ ] `services/wa-client/src/index.ts:172` - 'PHONE_PAIRING_CODE_TTL_MS' was used before it was defined

---

### [DeepSource] Detected the use of require statements except in import statements (JS-0359)

**Category:** Issue
**Description:**
In other words, the use of forms such as `var foo = require("foo")` are banned. Instead use `ES6` style imports or `import foo = require("foo")` imports.

### Bad Practice

```ts
var foo = require('foo');
const foo = require('foo');
let foo = require('foo');
```


### Recommended

```ts
import foo = require('foo');
require('foo');
import foo from 'foo';
```

**Locations (7):**
- [ ] `tests/integration/vitest.setup.ts:17` - Require statement not part of import statement
- [ ] `services/control-plane/src/__tests__/routes.test.ts:110` - Require statement not part of import statement
- [ ] `packages/shared/src/__tests__/url.test.ts:11` - Require statement not part of import statement
- [ ] `packages/shared/src/__tests__/ssrf.test.ts:7` - Require statement not part of import statement
- [ ] `packages/shared/src/__tests__/config.test.ts:67` - Require statement not part of import statement
- [ ] `packages/shared/src/__tests__/config.test.ts:55` - Require statement not part of import statement
- [ ] `packages/shared/src/__tests__/config.test.ts:16` - Require statement not part of import statement

---

### [DeepSource] Private members should be marked as `readonly` (JS-0368)

**Category:** Issue
**Description:**
Private members are marked as `readonly` if they're never modified outside of the constructor.

### Bad Practice

```ts
class Container {
  // These member variables could be marked as readonly
  private neverModifiedMember = true;
  private onlyModifiedInConstructor: number;

  public constructor(
    onlyModifiedInConstructor: number,
    // Private parameter properties can also be marked as readonly
    private neverModifiedParameter: string,
  ) {
    this.onlyModifiedInConstructor = onlyModifiedInConstructor;
  }
}
```


### Recommended

```ts
class Container {
  // Public members might be modified externally
  public publicMember: boolean;

  // Protected members might be modified by child classes
  protected protectedMember: number;

  // This is modified later on by the class
  private modifiedLater = 'unchanged';

  public mutate() {
    this.modifiedLater = 'mutated';
  }
}
```

**Locations (1):**
- [ ] `tests/stubs/bottleneck.ts:5` - Member 'reservoir' is never reassigned; mark it as `readonly`

---

### [DeepSource] Unused return value from `Array`/`Object` prototype method (JS-D008)

**Category:** Issue
**Description:**
Many built-in functions defined on prototypes for `Object` and `Array` are pure, and return modified versions of their inputs.
If the return values from these functions aren't used, the function call is essentially a no-op and might as well be removed.

```js
// These calls do not modify the array, instead they
// return new arrays with the desired properties.
xs.map(x => x.prop)
xs.filter(x => x.prop === 'value')
xs.concat(ys)
xs.reduce((x, y) => (x.value + y.value))
```
<!-- more -->

Perhaps, you're using `map` to iterate over an array and induce some side-effect, like logging to the console as shown here:

```js
xs.map((x, i) => console.log(`element #${i}:`, x))
```
This use of `map` is however misleading.
The `map`/`filter`/`concat` methods should only ever be used to produce new arrays that are used elsewhere.
Instead, you should use the `forEach` method:

```js
xs.forEach((x, i) => console.log(`element #${i}:`, x))
```

### Bad Practice

```js
const characters = [
  { name: 'Paul Atreides', age: 15 },
  { name: 'Kaladin Stormblessed', age: 19 },
  { name: 'Miss Kobayashi', age: 25 },
  { name: 'Eren Yeager', age: 14 },
  { name: 'Illidan Stormrage', age: 3000 }
]

characters.map(character => character.name);

// characters array is not modified by the call to `map`.
console.log(characters) 
```

### Recommended
```js
const characters = [
  { name: 'Paul Atreides', age: 15 },
  { name: 'Kaladin Stormblessed', age: 19 },
  { name: 'Miss Kobayashi', age: 25 },
  { name: 'Eren Yeager', age: 14 },
  { name: 'Illidan Stormrage', age: 3000 }
]

// array returned by call to `map` is now stored.
const characterNames = characters.map(character=> character.name);
console.log(characterNames)
//  [ 'Paul Atreides', 'Kaladin Stormblessed', 'Miss Kobayashi', 'Eren Yeager', 'Illidan Stormrage' ]
```

**Locations (2):**
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:113` - Return value from 'map' method is unused
- [ ] `whatsapp-web.js/src/Client.js:1661` - Return value from 'map' method is unused

---

### [DeepSource] Found complex boolean return (JS-W1041)

**Category:** Issue
**Description:**
The following pattern:

```javascript
if (condition) {
  return true
}
return false
```

can be refactored to:

```javascript
return condition
```

When `condition` is not a boolean value,
it can be cast into one using the `Boolean` constructor.

### Bad Practice

```typescript
function isEven(num: number) {
  if (num % 2 === 0) return true
  return false
}

async function userExists(name: string) {
  if (await db.getUser(name)) return true
  return false
}
```

### Recommended

```typescript
function isEven(num: number) {
  return num % 2 === 0
}

async function userExists(name: string) {
  return Boolean(await db.getUser(name))
}
```

**Locations (3):**
- [ ] `whatsapp-web.js/src/structures/Chat.js:198` - Boolean return can be simplified
- [ ] `whatsapp-web.js/src/structures/Channel.js:295` - Boolean return can be simplified
- [ ] `services/scan-orchestrator/src/blocklists.ts:40` - Boolean return can be simplified

---

### [DeepSource] Found constant expressions in conditions (JS-0003)

**Category:** Issue
**Description:**
A constant expression such as a literal when used as a condition in an `if`/ `for` / `while` or `do...while` statement can cause errors in a production environment.

<!--more-->

Usage of such constructs in a development environment for debugging triggers is common, but it's not a good practice to push them to VCS.

### Bad Practice

```js
if (false) {
    doSomethingUnfinished();
}

if (void x) {
    doSomethingUnfinished();
}

for (;-2;) {
    doSomethingForever();
}

while (typeof x) {
    doSomethingForever();
}

do {
    doSomethingForever();
} while (x = -1);

const result = 0 ? a : b;
```

### Recommended

```js
if (foo()) {
    doSomethingUnfinished();
}

for (let i = 0; i < foo; ++i) {
    doSomethingForever();
}

while (true) {
    doSomethingForever();
}

do {
    doSomethingForever();
} while (x == -1);

const result = cond() ? a : b;
```

**Locations (1):**
- [ ] `packages/shared/src/circuit-breaker.ts:98` - Unexpected constant condition

---

### [DeepSource] Found control characters in regular expressions (JS-0004)

**Category:** Issue
**Description:**
Control characters are special, invisible characters in the ASCII range 0-31.
These characters are rarely used in JavaScript strings, so a regular expression containing these characters is most likely a mistake.

<!--more-->

### Bad Practice

```js
const pattern1 = /\x1f/;
const pattern2 = new RegExp("\x1f");
```

### Recommended

```js
const pattern1 = /\x20/;
const pattern2 = new RegExp("\x20");
```

**Locations (1):**
- [ ] `packages/shared/src/homoglyph.ts:25` - Unexpected control character(s) in regular expression: \x00

---

### [DeepSource] `eval()` should not be used (JS-0060)

**Category:** Issue
**Description:**
JavaScript's `eval()` function is potentially dangerous and is often misused.
Using `eval()` on untrusted code can open a program up to several different injection attacks.
The use of `eval()` in most contexts can be substituted for a better, alternative approach to the problem.

<!--more-->

### Bad Practice

```js
const obj = { x: "foo" }
const key = "x"
const value = eval("obj." + key);

(0, eval)("var a = 0");

const foo = eval;
foo("var a = 0");

// This `this` is the global object.
this.eval("var a = 0");
```

### Recommended

```js
const obj = { x: "foo" },
    key = "x",
    value = obj[key];

class A {
    foo() {
        // This is a user-defined method.
        this.eval("var a = 0");
    }

    eval() { /* ... * / }
}
```

## References
- [OWASP A03:2021 - Injection](https://owasp.org/Top10/A03_2021-Injection/)
- [OWASP Direct Dynamic Code Evaluation - Eval Injection](https://owasp.org/www-community/attacks/Direct_Dynamic_Code_Evaluation_Eval%20Injection)

**Locations (1):**
- [ ] `whatsapp-web.js/src/util/Injected/AuthStore/LegacyAuthStore.js:6` - eval can be harmful

---

### [DeepSource] Unit test class with no tests (PTC-W0046)

**Category:** Issue
**Description:**
Test methods should always start with the `test`. If there are no such methods,
the class overriding `unittest.TestCase` won't run any test.

Not preferred:
```python
import unittest

def Tests(unittest.TestCase):
    def my_test(self, arg1, arg2):
        self.assertEquals(arg1, arg2)
```

Preferred:
```python
import unittest

def Tests(unittest.TestCase):
    def test_something(self, arg1, arg2):
        self.assertEquals(arg1, arg2)
```

**Locations (1):**
- [ ] `scripts/agent_orchestrator/tests/test_orchestrator.py:74` - Unittest class `BaseOrchestratorTest` contains no test methods

---

### [DeepSource] Unnecessary `return await` function found (JS-0111)

**Category:** Issue
**Description:**
Returning an awaited value (like with `return await f()`) has two problems:

 - It queues an extra microtask, blocking the callstack until `return` is executed.

 - `try` blocks only catch a rejected promise if its *`await`ed*. `return await` may introduce unexpected hidden control-flow when handling errors.

### Bad Practice

```js
async function getUserByName(name: string) {
  // find() returns a Promise<User | null >.
  // This promise should be `await`ed by the caller of `getUserByName`.
  return await db.users.find({ userName: name })
}
```

### Recommended

```js
async function getUserByName(name: string) {
  // find() returns a Promise<User | null >.
  return db.users.find({ userName: name })
}

// OR:

async function getUserByName(name: string) {
  // If we must `await` the return-value in this function
  // it's better to do it this way. This is more performant:
  const user = await db.users.find({ userName: name })
  return user;
}
```

### References

- [Return await promise vs Return promise in JavaScript](https://dmitripavlutin.com/return-await-promise-javascript/)
- [ESLint - no-return-await](https://eslint.org/docs/latest/rules/no-return-await)

**Locations (10):**
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:93` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:82` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:575` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:569` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:533` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Message.js:750` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Message.js:565` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Message.js:564` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Message.js:555` - Redundant use of `await` on a return value
- [ ] `whatsapp-web.js/src/structures/Message.js:554` - Redundant use of `await` on a return value

---

### [DeepSource] Should not have unused variables (JS-0128)

**Category:** Issue
**Description:**
Found variables that are declared but not used anywhere.

> **NOTE**: In browser applications, DeepSource recommends the use of ESModules over regular `text/javascript` scripts.
> Currently, we don't support variables that are not explicitly exported,
> and are injected into other scripts by being included in an HTML file

<!--more-->

Unused variables are most often the result of incomplete refactoring.
They can lead to confusing code and minor performance hitches.

**NOTE:** If you have intentionally left a variable unused, we suggest you to prefix the variable name with a `_` to prevent them from being flagged by DeepSource.

### Bad Practice

```js
// Write-only variables are not considered as used.
let y = 10;
y = 5;

// A variable that modifies only itself isn't considered used.
let z = 0;
z = z + 1;

// Unused argument
(function(x) {
    return 5;
})();

// Unused recursive functions also raise this issue.
function fact(n) {
    if (n < 2) return 1;
    return n * fact(n - 1);
}

// When a function definition destructures an array,
// unused entries from the array also cause warnings.
function getY([x, y]) {
    return y;
}
```

### Recommended

```js
let x = 10;
alert(x);

((arg1) => {
    return arg1;
})();

let myFunc;
myFunc = (n) => {
    // this is legal
    if (n < 0) myFunc();
};

// this is also considered legal
console.log(declaredLater);
var declaredLater;

// Only the second argument from the descructured array is used.
function getY([, y]) {
    return y;
}
```

**Locations (2):**
- [ ] `scripts/setup/orchestrator.mjs:441` - 'runtime' is defined but never used
- [ ] `scripts/setup/core/env-file.mjs:3` - 'path' is defined but never used

---

### [DeepSource] Variable used before definition (JS-0129)

**Category:** Issue
**Description:**
It is recommended to use a variable only after it is defined as it might produce errors at runtime.

<!--more-->

In JavaScript, prior to ES6, variable and function declarations are hoisted to the top of a scope, so it's possible to use identifiers before their formal declarations in code. This can be confusing and some believe it is best to always declare variables and functions before using them.

In ES6, block-level bindings (`let` and `const`) introduce a "temporal dead zone" where a `ReferenceError` will be thrown with any attempt to access the variable before its declaration.

### Bad Practice

```js
alert(a);
var a = 10;

f();
function f() {}

function g() {
    return b;
}
var b = 1;

{
    alert(c);
    let c = 1;
}
```

### Recommended

```js
var a;
a = 10;
alert(a);

function f() {}
f(1);

var b = 1;
function g() {
    return b;
}

{
    let c;
    c++;
}
```

**Locations (1):**
- [ ] `scripts/watch-pairing-code.js:158` - 'shutdown' was used before it was defined

---

## MEDIUM Priority Issues (14)

### [SonarQube] Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service. (typescript:S5852)

**Category:** Security Hotspot
**Description:**
Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.

**Locations (9):**
- [ ] `packages/shared/src/reputation/advanced-heuristics.ts:31` - Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.
- [ ] `packages/shared/src/url-shortener.ts:103` - Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.
- [ ] `services/scan-orchestrator/src/__tests__/fallback.test.ts:141` - Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.
- [ ] `services/scan-orchestrator/src/index.ts:493` - Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.
- [ ] `services/scan-orchestrator/src/index.ts:528` - Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.
- [ ] `services/scan-orchestrator/src/index.ts:876` - Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.
- [ ] `services/scan-orchestrator/src/urlscan-artifacts.ts:52` - Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.
- [ ] `services/wa-client/src/index.ts:778` - Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.
- [ ] `services/wa-client/src/remoteAuthStore.ts:33` - Make sure the regex used here, which is vulnerable to super-linear runtime due to backtracking, cannot lead to denial of service.

---

### [SonarQube] Make sure that using this pseudorandom number generator is safe here. (javascript:S2245)

**Category:** Security Hotspot
**Description:**
Make sure that using this pseudorandom number generator is safe here.

**Locations (1):**
- [ ] `scripts/watch-pairing-code.js:162` - Make sure that using this pseudorandom number generator is safe here.

---

### [SonarQube] Make sure that using this pseudorandom number generator is safe here. (typescript:S2245)

**Category:** Security Hotspot
**Description:**
Make sure that using this pseudorandom number generator is safe here.

**Locations (4):**
- [ ] `packages/shared/src/reputation/http-fingerprint.ts:79` - Make sure that using this pseudorandom number generator is safe here.
- [ ] `packages/shared/src/reputation/http-fingerprint.ts:83` - Make sure that using this pseudorandom number generator is safe here.
- [ ] `packages/shared/src/reputation/virustotal.ts:98` - Make sure that using this pseudorandom number generator is safe here.
- [ ] `services/wa-client/src/index.ts:1778` - Make sure that using this pseudorandom number generator is safe here.

---

## MINOR Priority Issues (39)

### [DeepSource] Logical operator can be refactored to optional chain (JS-W1044)

**Category:** Issue
**Description:**
The [optional chaining](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining)
operator can be used to perform null checks before accessing a property, or calling a function.

Using `&&` for this purpose is no longer required.

### Bad Practice

```typescript
function getUsernameFromId(id: number): string | undefined {
  const user = db.getUser(id)
  return user && user.name
}

someFunc && someFunc()
//        ^~~~ not necessary

maybeArray && maybeArray[index]
//          ^~~~ not necessary
```

### Recommended

```typescript
function getUsernameFromId(id: number): string | undefined {
  const user = db.getUser(id)
  return user?.name
}

someFunc?.()

maybeArray?.[index]
```

**Autofix Available:** Yes

**Locations (10):**
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:820` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:608` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:491` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:245` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:180` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `whatsapp-web.js/src/util/Injected/LegacyStore.js:110` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `whatsapp-web.js/src/util/Injected/LegacyStore.js:35` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `whatsapp-web.js/src/util/Injected/LegacyStore.js:34` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `whatsapp-web.js/src/util/Injected/LegacyStore.js:24` - Prefer using an optional chain expression instead, as it's more concise and easier to read
- [ ] `whatsapp-web.js/src/util/Injected/LegacyStore.js:23` - Prefer using an optional chain expression instead, as it's more concise and easier to read

---

### [DeepSource] Useless template literal found (JS-R1004)

**Category:** Issue
**Description:**
Template literals are useful when you need:

1. [Interpolated strings](https://en.wikipedia.org/wiki/String_interpolation).

2. Strings that have unescaped double quotes **and** single quotes.

3. Strings that need line breaks in them.

If neither of these three conditions is met,
you can replace the template expression with a regular string literal.

### Bad Practice

```js
const dialogue = `"Journey before destination", said Dalinar.`
const dialogue2 = `What is a 'Kwisatz Haderach'?`
```

### Recommended

```js
const dialogue = '"Journey before destination", said Dalinar.'
const dialogue2 = "What is a 'Kwisatz Haderach'?"
const dialogue3 = `"${getLine()}", said ${getChararcter()}`
```

**Autofix Available:** Yes

**Locations (10):**
- [ ] `services/scan-orchestrator/src/index.ts:1491` - Template string can be replaced with regular string literal
- [ ] `services/scan-orchestrator/src/index.ts:1478` - Template string can be replaced with regular string literal
- [ ] `scripts/setup/artifacts/transcript.mjs:104` - Template string can be replaced with regular string literal
- [ ] `scripts/setup/artifacts/transcript.mjs:100` - Template string can be replaced with regular string literal
- [ ] `scripts/setup/artifacts/transcript.mjs:99` - Template string can be replaced with regular string literal
- [ ] `scripts/setup/artifacts/transcript.mjs:97` - Template string can be replaced with regular string literal
- [ ] `scripts/setup/artifacts/transcript.mjs:96` - Template string can be replaced with regular string literal
- [ ] `scripts/setup/artifacts/transcript.mjs:92` - Template string can be replaced with regular string literal
- [ ] `scripts/setup/artifacts/transcript.mjs:91` - Template string can be replaced with regular string literal
- [ ] `scripts/setup/artifacts/transcript.mjs:77` - Template string can be replaced with regular string literal

---

### [DeepSource] Prefer adding `u` flag in regular expressions (JS-0117)

**Category:** Issue
**Description:**
It is recommended to use the `u` flag with regular expressions.

<!--more-->

The `u` flag has two effects:
- It enables correct handling of  UTF-16 surrogate pairs.
- It ensures the correct behavior of regex character ranges.

```js
/^[👍]$/.test("👍") //→ false
/^[👍]$/u.test("👍") //→ true
```

For historical reasons, JavaScript regular expressions tolerate syntax errors.
For example, `/\w{1, 2/` is a regex that would throw a syntax error, but JavaScript chooses not to.
It matches strings such as `"a{1, 2"` instead.
This behaviour is defined in Annex B of the Javascript specification.

The `u` flag disables the recovering logic `Annex B` of the Javascript specification.
This way, you can find errors early.
It can therefore be thought of as a "strict mode" for RegEx literals.

This issue is raised when:
- A regular expression contains unicode property escapes i.e `\p{<property-name>}`
- A regular expression contains 4 bytes characters like emojis or some special characters

### Bad Practice

```js
const a = /aaa/
const b = /bbb/gi
const c = new RegExp("ccc")
const d = new RegExp("ddd", "gi")
```

### Recommended

```js
const a = /aaa/u
const b = /bbb/giu
const c = new RegExp("ccc", "u")
const d = new RegExp("ddd", "giu")

// This rule ignores RegExp calls if the flags are not a compile time constant.
function f(flags) {
    return new RegExp("eee", flags)
}
```


## References

- [Regular Expressions Patterns](https://www.ecma-international.org/ecma-262/6.0/#sec-regular-expressions-patterns)
- [JavaScript strict mode](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode)
- [Unicode properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions/Unicode_Property_Escapes)

**Autofix Available:** Yes

**Locations (2):**
- [ ] `packages/shared/src/url.ts:13` - Use the 'u' flag with regular expressions
- [ ] `packages/shared/src/homoglyph.ts:25` - Use the 'u' flag with regular expressions

---

### [DeepSource] Unnecessary calls to `.bind()` (JS-0062)

**Category:** Issue
**Description:**
The bind() method is used to create functions with specific `this` values and, optionally, binds arguments to specific values.
When used to specify the value of `this`, it's important that the function actually uses `this` in its function body.

### Bad Practice

```
// useless bind
const boundGetName = (function getName() {
    return "ESLint"; // correct way -> return this.name;
}).bind({ name: "ESLint" });

console.log(boundGetName());      // "ESLint"
```

```js
let x = function () {
    foo();
}.bind(bar);

x = (() => foo()).bind(bar);
x = (() => this.foo()).bind(bar);

x = function () {
    (function () {
      this.foo();
    }());
}.bind(bar);

x = function () {
    function foo() {
      this.bar();
    }
}.bind(baz);
```

### Recommended

```js
let x = (function () {
    this.foo();
}).bind({ foo() { console.log("foo") }  } );

// no uneccessary `bind`s
function f(a) {
    return a + 1;
}
```

**Autofix Available:** Yes

**Locations (3):**
- [ ] `whatsapp-web.js/src/Client.js:810` - The function binding is unnecessary
- [ ] `whatsapp-web.js/src/Client.js:796` - The function binding is unnecessary
- [ ] `whatsapp-web.js/src/Client.js:763` - The function binding is unnecessary

---

### [DeepSource] Found leading or trailing decimal points in numeric literals (JS-0065)

**Category:** Issue
**Description:**
`Float` values in JavaScript contain a decimal point, and there is no requirement that the decimal point be preceded or followed by a number.
For example, the following are all valid JavaScript numbers:

```js
let num = .5;
num = 2.;
num = -.7;
```
Although not a syntax error, this format for numbers can make it difficult to distinguish between true decimal numbers and the dot operator.
For this reason, some recommend that you should always include a number before and after a decimal point to make it clear the intent is to create a decimal number.

### Bad Practice
```js
let num = .5;
num = 2.;
num = -.7;
```

### Recommended
```js
let num = 0.5;
num = 2.0;
num = -0.7;
```

**Autofix Available:** Yes

**Locations (1):**
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:851` - A leading decimal point can be confused with a dot

---

### [DeepSource] Found shorthand type coercions (JS-0066)

**Category:** Issue
**Description:**
Prefer using explicit casts by calling `Number`, `Boolean`, or `String` over using operators like `+`, `!!` or `"" +`.
This is considered best practice as it improves readability.

### Bad Practice
```js
const b = !!foo;
// The `+` operator does not change the value of its operand
// unless it's already a number.
let n = +foo;
n = 1 * foo;
const s = "" + foo;
```

### Recommended

```js
const b = Boolean(foo);
const n = Number(foo);
const s = String(foo);
```

**Autofix Available:** Yes

**Locations (10):**
- [ ] `whatsapp-web.js/src/util/Puppeteer.js:15` - use `Boolean(window[name])` instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:1065` - use `Number(error)` instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:988` - use `Number(code)` instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:983` - use `Number(code)` instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:976` - use `Number(code)` instead
- [ ] `whatsapp-web.js/src/structures/Chat.js:64` - use `Boolean(data.pin)` instead
- [ ] `services/wa-client/src/index.ts:1661` - use `Boolean(botWid)` instead
- [ ] `packages/shared/src/url.ts:79` - use `Boolean(t.publicSuffix)` instead
- [ ] `packages/shared/src/reputation/http-fingerprint.ts:159` - use `Boolean(headers['x-content-type-options'])` instead
- [ ] `packages/shared/src/reputation/http-fingerprint.ts:158` - use `Boolean(headers['x-frame-options'])` instead

---

### [DeepSource] Subprocess run with ignored non-zero exit (PYL-W1510)

**Category:** Issue
**Description:**
`subprocess.run` uses a default of `check=False`, which means that a nonzero exit code will be
ignored by default, instead of raising an exception.

You can ignore this issue if this behaviour is intended.

<!--more-->

### Bad practice
```python
# Nonzero exit code will be ignored here
subprocess.run(['notify-send', '-u', 'critical', msg])
```

### Recommended
```python
# Exception will be raised for nonzero exit code
subprocess.run(['notify-send', '-u', 'critical', msg], check=True) # some comment
```

**Autofix Available:** Yes

**Locations (8):**
- [ ] `scripts/agent_orchestrator/main.py:515` - 'subprocess.run' used without explicitly defining the value for 'check'.
- [ ] `scripts/agent_orchestrator/main.py:506` - 'subprocess.run' used without explicitly defining the value for 'check'.
- [ ] `scripts/agent_orchestrator/main.py:497` - 'subprocess.run' used without explicitly defining the value for 'check'.
- [ ] `scripts/agent_orchestrator/main.py:481` - 'subprocess.run' used without explicitly defining the value for 'check'.
- [ ] `scripts/agent_orchestrator/main.py:465` - 'subprocess.run' used without explicitly defining the value for 'check'.
- [ ] `scripts/agent_orchestrator/main.py:418` - 'subprocess.run' used without explicitly defining the value for 'check'.
- [ ] `scripts/agent_orchestrator/agents.py:111` - 'subprocess.run' used without explicitly defining the value for 'check'.
- [ ] `scripts/agent_orchestrator/agents.py:55` - 'subprocess.run' used without explicitly defining the value for 'check'.

---

### [DeepSource] Found unused expressions (JS-0093)

**Category:** Issue
**Description:**
An unused expression that does not affect the state of the program indicates a logic error.

<!--more-->

For example, if a programmer wants to increment the value of a variable `a` by one, and intends to do so through this code:

```js
let a = 0
a = a + 1
console.log(a) // output 1
```

But because of a typo, writes the following:

```js
let a = 0
a + 1
console.log(a)
```

Here, the expression `a + 1` does nothing meaningful in the program's runtime.
The expression is thus considered "unused" and should be removed.

### Bad Practice

```js
0

if(0) 0

{0}

f(0), {}

a, b()

c = a, b;

a() && function namedFunctionInExpressionContext () {f();}

(function anIncompleteIIFE () {});

injectGlobal`body{ color: red; }`

```


### Recommended

```js
{} // In this context, this is a block statement, not an object literal

{myLabel: someVar} // In this context, this is a block statement with a label and expression, not an object literal

function namedFunctionDeclaration () {}

(function aGenuineIIFE () {}());

f()

a = 0

new C

delete a.b

void a
```

**Autofix Available:** Yes

**Locations (10):**
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:1078` - Found unused expression
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:1030` - Found unused expression
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:1007` - Found unused expression
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:655` - Found unused expression
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:612` - Found unused expression
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:84` - Found unused expression
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:48` - Found unused expression
- [ ] `whatsapp-web.js/src/structures/Message.js:683` - Found unused expression
- [ ] `whatsapp-web.js/src/structures/Message.js:676` - Found unused expression
- [ ] `whatsapp-web.js/src/structures/GroupChat.js:310` - Found unused expression

---

### [DeepSource] Found trailing undefined in function call (JS-W1042)

**Category:** Issue
**Description:**
When an argument is omitted from a function call, it will default to `undefined`.
It is therefore redundant to explicitly pass an `undefined` literal as the last argument.

### Bad Practice

```typescript
function hasOptionalParam(a: number, b?: number) {
  // ...
}

hasOptionalParam(1, undefined)
```

### Recommended

```typescript
function hasOptionalParam(a: number, b?: number) {
  // ...
}

hasOptionalParam(1)
hasOptionalParam(1, 2)
```

**Autofix Available:** Yes

**Locations (3):**
- [ ] `whatsapp-web.js/tests/structures/group.js:42` - Remove redundant `undefined` from function call
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:922` - Remove redundant `undefined` from function call
- [ ] `scripts/jest-env-setup.js:26` - Remove redundant `undefined` from function call

---

### [DeepSource] Found unnecessary constructors (JS-0237)

**Category:** Issue
**Description:**
ES2015 provides a default class constructor if one is not specified. As such, it is unnecessary to provide an empty constructor or one that simply delegates into its parent class, as in the following examples:
```
class A {
    constructor () {
    }
}

class B extends A {
    constructor (value) {
      super(value);
    }
}
```

### Bad Practice

```js
class A {
    constructor () {
    }
}

class B extends A {
    constructor (...args) {
      super(...args);
    }
}
```

### Recommended

```js
class A { }

class A {
    constructor () {
        doSomething();
    }
}

class B extends A {
    constructor() {
        super('foo');
    }
}

class B extends A {
    constructor() {
        super();
        doSomething();
    }
}
```

**Locations (4):**
- [ ] `whatsapp-web.js/src/structures/ScheduledEvent.js:63` - Useless constructor
- [ ] `whatsapp-web.js/src/structures/ScheduledEvent.js:57` - Useless constructor
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:7` - Useless constructor
- [ ] `whatsapp-web.js/src/Client.js:2284` - Useless constructor

---

### [DeepSource] Use shorthand property syntax for object literals (JS-0240)

**Category:** Issue
**Description:**
ECMAScript 6 provides a concise form for defining object literal methods and properties.
This syntax can make defining complex object literals much cleaner.

Here are a few common examples using the ES5 syntax:
```
const x = 1, y = 2, z = 3;
// properties
const foo = {
    x: x,
    y: y,
    z: z,
};

// methods
const foo = {
    a: function() {},
    b: function() {}
};
```

The ES6 equivalent syntax is::
```
// properties
const foo = {x, y, z};

// methods
const bar = {
    a() { return 1 },
    b() { return 2 }
};
```

**NOTE:** The shorthand properties are equivalent to function expressions.
Meaning that they do not bind their own `this` inside their bodies.
It is still possible to access properties from the object inside a shorthand member function:

```js
const object = {
    x: 1,
    getX() {
        return this.x // valid
    }
}
```

### Bad Practice

```js
const foo = {
    bar: function () { return 1 }
};
```

### Recommended

```js
const foo = {
    bar() { return 1 }
}
```

**Locations (10):**
- [ ] `whatsapp-web.js/src/util/Util.js:127` - Expected property shorthand
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:54` - Expected property shorthand
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:533` - Expected property shorthand
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:302` - Expected property shorthand
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:253` - Expected property shorthand
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:250` - Expected property shorthand
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:206` - Expected property shorthand
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:103` - Expected property shorthand
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:102` - Expected property shorthand
- [ ] `whatsapp-web.js/src/structures/Message.js:729` - Expected property shorthand

---

### [DeepSource] Use `const` declarations for variables that are never reassigned (JS-0242)

**Category:** Issue
**Description:**
Variables that are never re-assigned a new value after their initial declaration should be declared with the `const` keyword.
This prevents the programmer from erroneously re-assigning to a read-only variable, and informs those reading the code that a variable is a constant value.

### Bad Practice

```js
let pi = Math.PI

for (let x of xs) {
  use(x);
}

let { a, b } = object;
use(a, b);
```

### Recommended

```js
const pi = Math.PI

for (const x of xs) {
  use(x);
}

const { a, b } = object;
use(a, b);
```

**Locations (10):**
- [ ] `whatsapp-web.js/src/util/Util.js:167` - 'exif' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Util.js:166` - 'jsonBuffer' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Util.js:165` - 'exifAttr' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:40` - 'chat' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:29` - 'chat' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:1000` - 'result' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:829` - 'userId' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:819` - 'product' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:818` - 'sellerId' is never reassigned. Use 'const' instead
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:791` - 'res' is never reassigned. Use 'const' instead

---

### [DeepSource] Require template literals instead of string concatenation (JS-0246)

**Category:** Issue
**Description:**
In ES2015 (ES6), we can use template literals instead of string concatenation.
```
var str = `Hello, ${name}!`;
```

### Bad Practice

```js
var str = "Hello, " + name + "!";
var str = "Time: " + (12 * 60 * 60 * 1000);
```

### Recommended

```js
var str = "Hello World!";
var str = `Hello, ${name}!`;
var str = `Time: ${12 * 60 * 60 * 1000}`;

var str = "Hello, " + "World!";
```

**Locations (10):**
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:829` - Unexpected string concatenation
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:828` - Unexpected string concatenation
- [ ] `whatsapp-web.js/src/util/Injected/AuthStore/LegacyAuthStore.js:6` - Unexpected string concatenation
- [ ] `whatsapp-web.js/src/Client.js:335` - Unexpected string concatenation
- [ ] `whatsapp-web.js/src/Client.js:185` - Unexpected string concatenation
- [ ] `whatsapp-web.js/example.js:286` - Unexpected string concatenation
- [ ] `whatsapp-web.js/example.js:286` - Unexpected string concatenation
- [ ] `whatsapp-web.js/example.js:282` - Unexpected string concatenation
- [ ] `whatsapp-web.js/example.js:62` - Unexpected string concatenation
- [ ] `whatsapp-web.js/example.js:59` - Unexpected string concatenation

---

### [DeepSource] Detected the `delete` operator with computed key expressions (JS-0320)

**Category:** Issue
**Description:**
Deleting dynamically computed keys can be dangerous and in some cases not well optimized.

<!-- more -->
Using the `delete` operator on keys that aren't runtime constants could be a sign that you're using the wrong data structures.
Using `Objects` with added and removed keys can cause occasional edge case bugs, such as if a key is named `"hasOwnProperty"`.
Consider using a `Map` or `Set` if you’re storing collections of objects.

### Bad Practice
```ts
// Can be replaced with the constant equivalents, such as container.aaa
delete container['aaa'];
delete container['Infinity'];

// Dynamic, difficult-to-reason-about lookups
const name = 'name';
delete container[name];
delete container[name.toUpperCase()];
```

### Recommended
```ts
const container: { [i: string]: number } = {
  /* ... */
};

// Constant runtime lookups by string index
delete container.aaa;

// Constants that must be accessed by []
delete container[7];
delete container['-Infinity'];
```

**Locations (1):**
- [ ] `services/wa-client/src/state/messageStore.ts:182` - Do not delete dynamically computed property keys

---

### [DeepSource] Detected empty functions (JS-0321)

**Category:** Issue
**Description:**
Having empty functions hurts readability, and is considered a code-smell.
There's almost always a way to avoid using them.
If you must use one, consider adding a comment to inform the reader of its purpose.

### Bad Practice

```ts
getUser('SwaGaLisTiQuE', () => {})
```

### Recommended

```ts
getUser('SwaGaLisTiQuE', () => {
    // empty because <reason>
})
```

**Locations (9):**
- [ ] `tests/e2e/control-plane.test.ts:22` - Unexpected empty method 'on'
- [ ] `services/wa-client/src/index.ts:151` - Unexpected empty method 'on'
- [ ] `services/wa-client/src/__tests__/sessionCleanup.test.ts:15` - Unexpected empty arrow function
- [ ] `services/wa-client/src/__tests__/sessionCleanup.test.ts:12` - Unexpected empty arrow function
- [ ] `services/wa-client/src/__tests__/commands.test.ts:19` - Unexpected empty method 'on'
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:36` - Unexpected empty arrow function
- [ ] `services/wa-client/__tests__/functional/force-new-session.e2e.test.ts:35` - Unexpected empty arrow function
- [ ] `services/scan-orchestrator/src/index.ts:187` - Unexpected empty method 'on'
- [ ] `services/control-plane/src/index.ts:129` - Unexpected empty method 'on'

---

### [DeepSource] Invalid `async` keyword (JS-0376)

**Category:** Issue
**Description:**
A function that does not contain any `await` expressions should not be `async` (except for some edge cases
in TypeScript which are discussed below).
Asynchronous functions in JavaScript behave differently than other functions in two important ways:

- The return value is always a `Promise`.
- You can use the `await` operator inside them.

Functions are made `async` so that we can use the `await` operator inside them.
Consider this example:

```js
async function fetchData(processDataItem) {
    const response = await fetch(DATA_URL);
    const data = await response.json();

    return data.map(processDataItem);
}
```

Asynchronous functions that don't use `await` might be an unintentional result of refactoring.

Note: This issue ignores async generator functions.
Generators `yield` rather than `return` a value and `async` generators might yield all the values of another async generator without ever actually needing to use `await`.

In TypeScript, one might feel the need to make a function `async` to comply with type signatures defined by an interface.
Ideally, the code should be refactored to get rid of such restrictions, but sometimes that isn't feasible
(For example, when we are implementing an interface defined in a 3rd party library like Next.js).

This situation can easily be circumvented by returning the value with a call to `Promise.resolve`:

```ts
interface HasAsyncFunc {
  getNum: () => Promise<number>
}

// Not recommended:
const o: HasAsyncFunc = {
  async getNum() { return 1 }
}

// Recommended:
const o: HasAsyncFunc = {
  // We only use `Promise.resolve` to adhere to the type
  // of the surrounding object.
  getNum() { return Promise.resolve(1) }
}
```

It is also advised to add a comment near the redundant promise to make the intent clear.

### Bad Practice

```ts
async function promise1() {
  return 1
}

async function fetchJSON(url: string) {
  return axios.get(url)
}
```

### Recommended

```ts
function promise1() {
  return Promise.resolve(1);
}

async function fetchJSON(url: string) {
  const data = await axios.get(url)
  return data.payload;
}
```

**Locations (1):**
- [ ] `tests/stubs/bottleneck.ts:17` - Async method 'currentReservoir' has no 'await' expression

---

### [DeepSource] Found short variable name (JS-C1002)

**Category:** Issue
**Description:**
Short variable names affect code readability and complicate code refactoring, because of the difficulty in searching and replacing such short characters.
<!--more-->

This issue will not be raised for certain special identifiers, such as `i`, `j` or `n`. It will also not be reported for the parameters used in `for` and `while` loops.

### Bad Practice

```js
var a;
const l = 90
```

### Recommended

```js
var age;
const limit = 90;


for(let o = 2; o < 10; o++){
    sum += o
}
```

**Locations (10):**
- [ ] `services/wa-client/src/index.ts:1282` - Variable name is too small
- [ ] `services/scan-orchestrator/src/index.ts:967` - Variable name is too small
- [ ] `scripts/ui/prompt-runner.mjs:7` - Variable name is too small
- [ ] `scripts/export-wwebjs-docs.mjs:132` - Variable name is too small
- [ ] `scripts/export-wwebjs-docs.mjs:106` - Variable name is too small
- [ ] `packages/shared/src/url.ts:77` - Variable name is too small
- [ ] `packages/shared/src/url.ts:53` - Variable name is too small
- [ ] `packages/shared/src/url.ts:20` - Variable name is too small
- [ ] `packages/shared/src/__tests__/url.test.ts:32` - Variable name is too small
- [ ] `packages/shared/src/__tests__/url.test.ts:27` - Variable name is too small

---

### [DeepSource] Avoid using wildcard imports (JS-C1003)

**Category:** Issue
**Description:**
Wildcard imports are easier to write,
but make it harder to pick out the specific functions or objects from a dependency that are used in a file.

```typescript
import * from 'module';

// there is no clear way to tell if 
// `someFunction` has been imported
// from 'module'.
someFunction();
```

Therefore, it is recommended to explicit imports wherever possible.

**NOTE:** Some libraries do not expose themselves as ESModules.
In cases like these, it is recommended to use a [skipcq](https://deepsource.com/docs/setup-analysis/#ignore-rules) comment
to suppress this issue.

### Bad Practice

```javascript
import * as axios from 'axios'
import * as Sentry from '@sentry/node'

try {
  const result = await axios.get();
  // ...
} catch (err) {
  Sentry.captureException(err);
}
```

### Recommended

```javascript
import axios from 'axios'
// skipcq: JS-C1003 - sentry does not expose itself as an ES Module.
import * as Sentry from '@sentry/node'

try {
  const result = await axios.get();
  // ...
} catch (err) {
  Sentry.captureException(err);
}
```

**Locations (3):**
- [ ] `packages/shared/src/reputation/http-fingerprint.ts:1` - Explicitly import the specific method needed
- [ ] `packages/shared/src/reputation/certificate-intelligence.ts:2` - Explicitly import the specific method needed
- [ ] `packages/shared/src/reputation/certificate-intelligence.ts:1` - Explicitly import the specific method needed

---

### [DeepSource] Found unused objects (JS-R1002)

**Category:** Issue
**Description:**
Class constructors being invoked and then dropped immediately is an anti-pattern and should be avoided.
<!--more-->
Objects instantiated with `new` should always be useful in some way (passed as a function argument, stored in a variable for later use, etc).
If the object is instantiated only to invoke some side effect in the constructor, then the side effect should be refactored out into it's own function.

### Bad Practice

```js
new Foo()
```

### Recommended

```js
const myFoo = new Foo()
```

**Locations (3):**
- [ ] `services/wa-client/src/index.ts:1760` - Avoid instantiating unused object 'new Worker(config.queues.scanVerdict, async (job) => {
    const queueName = config.queues.scanVerdict;
    const started = Date.now();
    const waitSeconds = Math.max(0, (started - (job.timestamp ?? started)) / 1000);
    metrics.queueJobWait.labels(queueName).observe(waitSeconds);
    const data = job.data as VerdictJobData & { decidedAt?: number; redirectChain?: string[]; shortener?: { provider: string; chain: string[] } | null };
    const payload: VerdictJobData = {
      chatId: data.chatId,
      messageId: data.messageId,
      verdict: data.verdict,
      reasons: data.reasons,
      url: data.url,
      urlHash: data.urlHash,
      decidedAt: data.decidedAt,
      redirectChain: data.redirectChain,
      shortener: data.shortener ?? null,
    };
    try {
      const delay = Math.floor(800 + Math.random() * 1200);
      await new Promise<void>((resolve) => {
        setTimeout(async () => {
          try {
            try {
              await groupLimiter.consume(payload.chatId);
              await groupHourlyLimiter.consume(payload.chatId);
            } catch {
              metrics.waMessagesDropped.labels('verdict_rate_limited').inc();
              return;
            }
            const key = `verdict:${payload.chatId}:${payload.urlHash}`;
            const nx = await redis.set(key, '1', 'EX', 3600, 'NX');
            if (nx === null) {
              metrics.waMessagesDropped.labels('verdict_duplicate').inc();
              return;
            }
            const context: VerdictContext = {
              chatId: payload.chatId,
              messageId: payload.messageId,
              urlHash: payload.urlHash,
            };
            await deliverVerdictMessage(client, payload, context);
          } finally {
            const verdictLatencySeconds = Math.max(0, (Date.now() - (payload.decidedAt ?? started)) / 1000);
            metrics.waVerdictLatency.observe(verdictLatencySeconds);
            const processingSeconds = (Date.now() - started) / 1000;
            metrics.queueProcessingDuration.labels(queueName).observe(processingSeconds);
            metrics.queueCompleted.labels(queueName).inc();
            if (job.attemptsMade > 0) {
              metrics.queueRetries.labels(queueName).inc(job.attemptsMade);
            }
            resolve();
          }
        }, delay);
      });
    } catch (err) {
      metrics.queueFailures.labels(queueName).inc();
      metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
      throw err;
    }
  }, { connection: redis })'
- [ ] `services/scan-orchestrator/src/index.ts:1440` - Avoid instantiating unused object 'new Worker(config.queues.urlscan, async (job) => {
      const queueName = config.queues.urlscan;
      const started = Date.now();
      const waitSeconds = Math.max(0, (started - (job.timestamp ?? started)) / 1000);
      metrics.queueJobWait.labels(queueName).observe(waitSeconds);
      const { url, urlHash: urlHashValue } = job.data as { url: string; urlHash: string };
      try {
        const submission: UrlscanSubmissionResponse = await urlscanCircuit.execute(() =>
          withRetry(
            () =>
              submitUrlscan(url, {
                callbackUrl: config.urlscan.callbackUrl || undefined,
                visibility: config.urlscan.visibility,
                tags: config.urlscan.tags,
              }),
            {
              retries: 2,
              baseDelayMs: 1000,
              factor: 2,
              retryable: shouldRetry,
            }
          )
        );
        recordLatency(CIRCUIT_LABELS.urlscan, submission.latencyMs);
        if (submission.uuid) {
          await redis.set(
            `${URLSCAN_UUID_PREFIX}${submission.uuid}`,
            urlHashValue,
            'EX',
            config.urlscan.uuidTtlSeconds
          );
          await redis.set(
            `${URLSCAN_SUBMITTED_PREFIX}${urlHashValue}`,
            submission.uuid,
            'EX',
            config.urlscan.uuidTtlSeconds
          );
          await pg.query(
            `UPDATE scans SET urlscan_uuid=$1, urlscan_status=$2, urlscan_submitted_at=now(), urlscan_result_url=$3 WHERE url_hash=$4`,
            [submission.uuid, 'submitted', submission.result ?? null, urlHashValue]
          );
        }
        metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
        metrics.queueCompleted.labels(queueName).inc();
        if (job.attemptsMade > 0) {
          metrics.queueRetries.labels(queueName).inc(job.attemptsMade);
        }
      } catch (err) {
        recordError(CIRCUIT_LABELS.urlscan, err);
        logger.error({ err, url }, 'urlscan submission failed');
        await pg.query(
          `UPDATE scans SET urlscan_status=$1, urlscan_completed_at=now() WHERE url_hash=$2`,
          ['failed', urlHashValue]
        ).catch(() => undefined);
        metrics.queueFailures.labels(queueName).inc();
        metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
        throw err;
      } finally {
        await refreshQueueMetrics(urlscanQueue, queueName).catch(() => undefined);
      }
    }, { connection: redis, concurrency: config.urlscan.concurrency })'
- [ ] `services/scan-orchestrator/src/index.ts:943` - Avoid instantiating unused object 'new Worker(config.queues.scanRequest, async (job) => {
    const queueName = config.queues.scanRequest;
    const started = Date.now();
    const waitSeconds = Math.max(0, (started - (job.timestamp ?? started)) / 1000);
    metrics.queueJobWait.labels(queueName).observe(waitSeconds);
    const { chatId, messageId, url, timestamp, rescan } = job.data as {
      chatId?: string;
      messageId?: string;
      url: string;
      timestamp?: number;
      rescan?: boolean;
    };
    const ingestionTimestamp = typeof timestamp === 'number' ? timestamp : job.timestamp ?? started;
    const hasChatContext = typeof chatId === 'string' && typeof messageId === 'string';
    try {
      const norm = normalizeUrl(url);
      if (!norm) {
        metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
        metrics.queueCompleted.labels(queueName).inc();
        if (job.attemptsMade > 0) {
          metrics.queueRetries.labels(queueName).inc(job.attemptsMade);
        }
        return;
      }
      const h = urlHash(norm);
      const cacheKey = `scan:${h}`;
      let cachedVerdict: any | null = null;
      let cachedTtl = -1;
      const cacheStop = metrics.cacheLookupDuration.labels(CACHE_LABELS.verdict).startTimer();
      const cachedRaw = await redis.get(cacheKey);
      cacheStop();
      if (cachedRaw) {
        recordCacheOutcome(CACHE_LABELS.verdict, 'hit');
        metrics.cacheHit.inc();
        metrics.cacheEntryBytes.labels(CACHE_LABELS.verdict).set(Buffer.byteLength(cachedRaw));
        cachedTtl = await redis.ttl(cacheKey);
        if (cachedTtl >= 0) {
          metrics.cacheEntryTtl.labels(CACHE_LABELS.verdict).set(cachedTtl);
        }
        try {
          cachedVerdict = JSON.parse(cachedRaw);
        } catch {
          metrics.cacheStaleTotal.labels(CACHE_LABELS.verdict).inc();
        }
        if (
          cachedVerdict &&
          typeof cachedVerdict.cacheTtl === 'number' &&
          cachedTtl >= 0 &&
          cachedTtl < Math.max(1, Math.floor(cachedVerdict.cacheTtl * 0.2))
        ) {
          metrics.cacheStaleTotal.labels(CACHE_LABELS.verdict).inc();
        }
      } else {
        recordCacheOutcome(CACHE_LABELS.verdict, 'miss');
        metrics.cacheMiss.inc();
        metrics.cacheEntryTtl.labels(CACHE_LABELS.verdict).set(0);
      }

      if (cachedVerdict) {
        const verdictLatencySeconds = Math.max(0, (Date.now() - ingestionTimestamp) / 1000);
        metrics.verdictLatency.observe(verdictLatencySeconds);
        metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
        metrics.queueCompleted.labels(queueName).inc();
        if (job.attemptsMade > 0) {
          metrics.queueRetries.labels(queueName).inc(job.attemptsMade);
        }
        const resolvedChatId = hasChatContext ? chatId : cachedVerdict.chatId;
        const resolvedMessageId = hasChatContext ? messageId : cachedVerdict.messageId;
        if (resolvedChatId && resolvedMessageId) {
          await scanVerdictQueue.add(
            'verdict',
            {
              chatId: resolvedChatId,
              messageId: resolvedMessageId,
              ...cachedVerdict,
              decidedAt: cachedVerdict.decidedAt ?? Date.now(),
            },
            { removeOnComplete: true }
          );
        } else {
          logger.info({ url: norm, jobId: job.id, rescan: Boolean(rescan) }, 'Skipping verdict dispatch without chat context');
        }
        return;
      }

      const shortenerInfo = await resolveShortenerWithCache(norm, h);
      const preExpansionUrl = shortenerInfo?.finalUrl ?? norm;
      const exp = await expandUrl(preExpansionUrl, config.orchestrator.expansion);
      const finalUrl = exp.finalUrl;
      const finalUrlObj = new URL(finalUrl);
      const redirectChain = [...(shortenerInfo?.chain ?? []), ...exp.chain.filter(item => !(shortenerInfo?.chain ?? []).includes(item))];
      const heurSignals = extraHeuristics(finalUrlObj);
      const wasShortened = Boolean(shortenerInfo?.wasShortened);
      const finalUrlMismatch = wasShortened && new URL(norm).hostname !== finalUrlObj.hostname;

      const homoglyphResult = detectHomoglyphs(finalUrlObj.hostname);
      if (homoglyphResult.detected) {
        metrics.homoglyphDetections.labels(homoglyphResult.riskLevel).inc();
        logger.info({ hostname: finalUrlObj.hostname, risk: homoglyphResult.riskLevel, confusables: homoglyphResult.confusableChars }, 'Homoglyph detection');
      }

      const enhancedSecurityResult = await enhancedSecurity.analyze(finalUrl, h);
      
      if (enhancedSecurityResult.verdict === 'malicious' && enhancedSecurityResult.confidence === 'high' && enhancedSecurityResult.skipExternalAPIs) {
        logger.info({ url: finalUrl, score: enhancedSecurityResult.score, reasons: enhancedSecurityResult.reasons }, 'Tier 1 high-confidence threat detected, skipping external APIs');
        
        const signals = {
          gsbThreatTypes: [],
          phishtankVerified: false,
          urlhausListed: false,
          vtMalicious: undefined,
          vtSuspicious: undefined,
          vtHarmless: undefined,
          domainAgeDays: undefined,
          redirectCount: redirectChain.length,
          wasShortened,
          finalUrlMismatch,
          manualOverride: null,
          homoglyph: homoglyphResult,
          ...heurSignals,
          enhancedSecurityScore: enhancedSecurityResult.score,
          enhancedSecurityReasons: enhancedSecurityResult.reasons,
        };
        
        const verdictResult = scoreFromSignals(signals);
        const verdict = 'malicious';
        const { score, reasons } = verdictResult;
        const enhancedReasons = [...reasons, ...enhancedSecurityResult.reasons];
        
        const cacheTtl = config.orchestrator.cacheTtl.malicious;
        const verdictPayload = {
          url: norm,
          finalUrl,
          verdict,
          score,
          reasons: enhancedReasons,
          cacheTtl,
          redirectChain,
          wasShortened,
          finalUrlMismatch,
          homoglyph: homoglyphResult,
          enhancedSecurity: {
            tier1Score: enhancedSecurityResult.score,
            confidence: enhancedSecurityResult.confidence,
          },
          decidedAt: Date.now(),
        };
        
        await setJsonCache(CACHE_LABELS.verdict, cacheKey, verdictPayload, cacheTtl);
        await pg.query(
          `INSERT INTO scans (url_hash, url, final_url, verdict, score, reasons, cache_ttl, redirect_chain, was_shortened, final_url_mismatch, homoglyph_detected, homoglyph_risk_level, decided_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
           ON CONFLICT (url_hash) DO UPDATE SET
             final_url=EXCLUDED.final_url,
             verdict=EXCLUDED.verdict,
             score=EXCLUDED.score,
             reasons=EXCLUDED.reasons,
             cache_ttl=EXCLUDED.cache_ttl,
             redirect_chain=EXCLUDED.redirect_chain,
             was_shortened=EXCLUDED.was_shortened,
             final_url_mismatch=EXCLUDED.final_url_mismatch,
             homoglyph_detected=EXCLUDED.homoglyph_detected,
             homoglyph_risk_level=EXCLUDED.homoglyph_risk_level,
             decided_at=now()`,
          [h, norm, finalUrl, verdict, score, JSON.stringify(enhancedReasons), cacheTtl, JSON.stringify(redirectChain), wasShortened, finalUrlMismatch, homoglyphResult.detected, homoglyphResult.riskLevel]
        ).catch((err: Error) => {
          logger.error({ err, url: norm }, 'failed to persist enhanced security verdict');
        });
        
        metrics.verdictScore.observe(score);
        for (const reason of enhancedReasons) {
          metrics.verdictReasons.labels(normalizeVerdictReason(reason)).inc();
        }
        
        const verdictLatencySeconds = Math.max(0, (Date.now() - ingestionTimestamp) / 1000);
        metrics.verdictLatency.observe(verdictLatencySeconds);
        metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
        metrics.queueCompleted.labels(queueName).inc();
        
        if (hasChatContext) {
          await scanVerdictQueue.add('verdict', {
            chatId,
            messageId,
            ...verdictPayload,
          }, { removeOnComplete: true });
        }
        
        await enhancedSecurity.recordVerdict(finalUrl, 'malicious', enhancedSecurityResult.score / 3.0);
        return;
      }

      const [blocklistResult, domainIntel, manualOverride] = await Promise.all([
        checkBlocklistsWithRedundancy({
          finalUrl,
          hash: h,
          fallbackLatencyMs: config.gsb.fallbackLatencyMs,
          gsbApiKeyPresent: Boolean(config.gsb.apiKey),
          phishtankEnabled: config.phishtank.enabled,
          fetchGsbAnalysis,
          fetchPhishtank,
        }),
        fetchDomainIntel(finalUrlObj.hostname, h),
        loadManualOverride(h, finalUrlObj.hostname),
      ]);

      if (manualOverride) {
        metrics.manualOverrideApplied.labels(manualOverride).inc();
      }

      const domainAgeDays = domainIntel.ageDays;
      const gsbMatches = blocklistResult.gsbMatches;
      const gsbHit = gsbMatches.length > 0;
      if (gsbHit) metrics.gsbHits.inc();

      const phishtankResult = blocklistResult.phishtankResult;
      const phishtankHit = Boolean(phishtankResult?.verified);

      let vtStats: VtStats | undefined;
      let vtQuotaExceeded = false;
      let vtError: Error | null = null;
      if (!gsbHit && !phishtankHit) {
        const vtResponse = await fetchVirusTotal(finalUrl, h);
        vtStats = vtResponse.stats;
        vtQuotaExceeded = vtResponse.quotaExceeded;
        vtError = vtResponse.error;
        if (!vtResponse.fromCache && !vtResponse.error) {
          metrics.vtSubmissions.inc();
        }
      }

      let urlhausResult: UrlhausResult | null = null;
      let urlhausError: Error | null = null;
      let urlhausConsulted = false;
      const shouldQueryUrlhaus =
        !gsbHit && (
          !config.vt.apiKey ||
          vtQuotaExceeded ||
          vtError !== null ||
          !vtStats
        );
      if (shouldQueryUrlhaus) {
        urlhausConsulted = true;
        const urlhausResponse = await fetchUrlhaus(finalUrl, h);
        urlhausResult = urlhausResponse.result;
        urlhausError = urlhausResponse.error;
      }

      const summarizeReason = (input?: string | null) => {
        if (!input) return 'unavailable';
        const trimmed = input.trim();
        if (trimmed.length === 0) return 'unavailable';
        return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
      };

      type ProviderState = {
        key: string;
        name: string;
        consulted: boolean;
        available: boolean;
        reason?: string;
      };

      const providerStates: ProviderState[] = [
        {
          key: 'gsb',
          name: 'Google Safe Browsing',
          consulted: true,
          available: !blocklistResult.gsbResult.error,
          reason: blocklistResult.gsbResult.error ? summarizeReason(blocklistResult.gsbResult.error.message) : undefined,
        },
      ];

      if (blocklistResult.phishtankNeeded) {
        providerStates.push({
          key: 'phishtank',
          name: 'Phishtank',
          consulted: true,
          available: !blocklistResult.phishtankError,
          reason: blocklistResult.phishtankError ? summarizeReason(blocklistResult.phishtankError.message) : undefined,
        });
      }

      const vtConsulted = !gsbHit && !phishtankHit && Boolean(config.vt.apiKey);
      if (vtConsulted) {
        let vtReason: string | undefined;
        if (!vtStats) {
          vtReason = vtQuotaExceeded ? 'quota_exhausted' : summarizeReason(vtError?.message ?? null);
        }
        providerStates.push({
          key: 'virustotal',
          name: 'VirusTotal',
          consulted: true,
          available: Boolean(vtStats) || (!vtError && !vtQuotaExceeded),
          reason: vtStats ? undefined : vtReason,
        });
      }

      if (urlhausConsulted) {
        providerStates.push({
          key: 'urlhaus',
          name: 'URLhaus',
          consulted: true,
          available: !urlhausError,
          reason: urlhausError ? summarizeReason(urlhausError.message) : undefined,
        });
      }

      const consultedProviders = providerStates.filter((state) => state.consulted);
      const availableProviders = consultedProviders.filter((state) => state.available);
      const degradedProviders = consultedProviders.filter((state) => !state.available);
      const degradedMode = consultedProviders.length > 0 && availableProviders.length === 0
        ? {
            providers: degradedProviders.map((state) => ({
              name: state.name,
              reason: state.reason ?? 'unavailable',
            })),
          }
        : undefined;

      if (degradedMode) {
        metrics.degradedModeEvents.inc();
        logger.warn({ url: finalUrl, urlHash: h, providers: degradedMode.providers }, 'Operating in degraded mode with no external providers available');
      }

      const signals = {
        gsbThreatTypes: gsbMatches.map(m => m.threatType),
        phishtankVerified: Boolean(phishtankResult?.verified),
        urlhausListed: Boolean(urlhausResult?.listed),
        vtMalicious: vtStats?.malicious,
        vtSuspicious: vtStats?.suspicious,
        vtHarmless: vtStats?.harmless,
        domainAgeDays,
        redirectCount: redirectChain.length,
        wasShortened,
        finalUrlMismatch,
        manualOverride,
        homoglyph: homoglyphResult,
        ...heurSignals,
        enhancedSecurityScore: enhancedSecurityResult.score,
        enhancedSecurityReasons: enhancedSecurityResult.reasons,
      };
      const verdictResult = scoreFromSignals(signals);
      const verdict = verdictResult.level;
      let { score, reasons } = verdictResult;
      
      if (enhancedSecurityResult.reasons.length > 0) {
        reasons = [...reasons, ...enhancedSecurityResult.reasons];
      }
      const baselineVerdict = scoreFromSignals({ ...signals, manualOverride: null }).level;

      metrics.verdictScore.observe(score);
      for (const reason of reasons) {
        metrics.verdictReasons.labels(normalizeVerdictReason(reason)).inc();
      }
      if (baselineVerdict !== verdict) {
        metrics.verdictEscalations.labels(baselineVerdict, verdict).inc();
      }
      if (gsbMatches.length > 0) {
        metrics.verdictSignals.labels('gsb_match').inc(gsbMatches.length);
      }
      if (phishtankHit) {
        metrics.verdictSignals.labels('phishtank_verified').inc();
      }
      if (urlhausResult?.listed) {
        metrics.verdictSignals.labels('urlhaus_listed').inc();
      }
      if ((vtStats?.malicious ?? 0) > 0) {
        metrics.verdictSignals.labels('vt_malicious').inc(vtStats?.malicious ?? 0);
      }
      if ((vtStats?.suspicious ?? 0) > 0) {
        metrics.verdictSignals.labels('vt_suspicious').inc(vtStats?.suspicious ?? 0);
      }
      if (wasShortened) {
        metrics.verdictSignals.labels('shortener').inc();
      }
      if (finalUrlMismatch) {
        metrics.verdictSignals.labels('redirect_mismatch').inc();
      }
      if (redirectChain.length > 0) {
        metrics.verdictSignals.labels('redirect_chain').inc(redirectChain.length);
      }
      if (homoglyphResult.detected) {
        metrics.verdictSignals.labels(`homoglyph_${homoglyphResult.riskLevel}`).inc();
      }
      if (typeof domainAgeDays === 'number') {
        metrics.verdictSignals.labels('domain_age').inc();
      }
      if (signals.manualOverride) {
        metrics.verdictSignals.labels(`override_${signals.manualOverride}`).inc();
      }

      const blocklistHit = gsbHit || phishtankHit || Boolean(urlhausResult?.listed);

      let enqueuedUrlscan = false;
      if (config.urlscan.enabled && config.urlscan.apiKey && verdict === 'suspicious') {
        const queued = await redis.set(
          `${URLSCAN_QUEUED_PREFIX}${h}`,
          '1',
          'EX',
          config.urlscan.uuidTtlSeconds,
          'NX'
        );
        if (queued) {
          enqueuedUrlscan = true;
          await urlscanQueue.add(
            'submit',
            {
              url: finalUrl,
              urlHash: h,
            },
            {
              removeOnComplete: true,
              removeOnFail: 500,
              attempts: 1,
            }
          );
        }
      }

      const ttlByLevel = config.orchestrator.cacheTtl as Record<string, number>;
      const ttl = ttlByLevel[verdict] ?? verdictResult.cacheTtl ?? 3600;

      metrics.verdictCacheTtl.observe(ttl);

      const decidedAt = Date.now();
      const res = {
        messageId,
        chatId,
        url: finalUrl,
        normalizedUrl: finalUrl,
        urlHash: h,
        verdict,
        score,
        reasons,
        gsb: { matches: gsbMatches },
        phishtank: phishtankResult,
        urlhaus: urlhausResult,
        vt: vtStats,
        urlscan: enqueuedUrlscan ? { status: 'queued' } : undefined,
        whois: domainIntel,
        domainAgeDays,
        redirectChain,
        ttlLevel: verdict,
        cacheTtl: ttl,
        shortener: shortenerInfo ? { provider: shortenerInfo.provider, chain: shortenerInfo.chain } : undefined,
        finalUrlMismatch,
        decidedAt,
        degradedMode,
      };
      await setJsonCache(CACHE_LABELS.verdict, cacheKey, res, ttl);

      await pg.query(`INSERT INTO scans (url_hash, normalized_url, verdict, score, reasons, vt_stats, gsafebrowsing_hit, domain_age_days, redirect_chain_summary, cache_ttl, source_kind, urlscan_status, whois_source, whois_registrar, shortener_provider)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        ON CONFLICT (url_hash) DO UPDATE SET last_seen_at=now(), verdict=EXCLUDED.verdict, score=EXCLUDED.score, reasons=EXCLUDED.reasons, vt_stats=EXCLUDED.vt_stats, gsafebrowsing_hit=EXCLUDED.gsafebrowsing_hit, domain_age_days=EXCLUDED.domain_age_days, redirect_chain_summary=EXCLUDED.redirect_chain_summary, cache_ttl=EXCLUDED.cache_ttl, urlscan_status=COALESCE(EXCLUDED.urlscan_status, scans.urlscan_status), whois_source=COALESCE(EXCLUDED.whois_source, scans.whois_source), whois_registrar=COALESCE(EXCLUDED.whois_registrar, scans.whois_registrar), shortener_provider=COALESCE(EXCLUDED.shortener_provider, scans.shortener_provider)`,
        [h, finalUrl, verdict, score, JSON.stringify(reasons), JSON.stringify(vtStats || {}), blocklistHit, domainAgeDays ?? null, JSON.stringify(redirectChain), ttl, 'wa', enqueuedUrlscan ? 'queued' : null, domainIntel.source === 'none' ? null : domainIntel.source, domainIntel.registrar ?? null, shortenerInfo?.provider ?? null]
      );
      if (enqueuedUrlscan) {
        await pg.query('UPDATE scans SET urlscan_status=$1 WHERE url_hash=$2', ['queued', h]).catch(() => undefined);
      }
      if (chatId && messageId) {
        await pg.query(`INSERT INTO messages (chat_id, message_id, url_hash, verdict, posted_at)
        VALUES ($1,$2,$3,$4,now()) ON CONFLICT DO NOTHING`, [chatId, messageId, h, verdict]).catch((err) => {
          logger.warn({ err, chatId, messageId }, 'failed to persist message metadata for scan');
        });

        await scanVerdictQueue.add('verdict', { ...res, chatId, messageId }, { removeOnComplete: true });
      } else {
        logger.info({ url: finalUrl, jobId: job.id, rescan: Boolean(rescan) }, 'Completed scan without chat context; skipping messaging flow');
      }
      
      await enhancedSecurity.recordVerdict(
        finalUrl,
        verdict === 'malicious' ? 'malicious' : verdict === 'suspicious' ? 'suspicious' : 'benign',
        score / 15.0
      ).catch((err) => {
        logger.warn({ err, url: finalUrl }, 'failed to record verdict for collaborative learning');
      });
      
      metrics.verdictCounter.labels(verdict).inc();
      const totalProcessingSeconds = (Date.now() - started) / 1000;
      metrics.verdictLatency.observe(Math.max(0, (Date.now() - ingestionTimestamp) / 1000));
      metrics.scanLatency.observe(totalProcessingSeconds);
      metrics.queueProcessingDuration.labels(queueName).observe(totalProcessingSeconds);
      metrics.queueCompleted.labels(queueName).inc();
      if (job.attemptsMade > 0) {
        metrics.queueRetries.labels(queueName).inc(job.attemptsMade);
      }
    } catch (e) {
      metrics.queueFailures.labels(queueName).inc();
      metrics.queueProcessingDuration.labels(queueName).observe((Date.now() - started) / 1000);
      logger.error(e, 'scan worker error');
    } finally {
      await refreshQueueMetrics(scanRequestQueue, queueName).catch(() => undefined);
    }
  }, { connection: redis, concurrency: config.orchestrator.concurrency })'

---

### [DeepSource] Function with cyclomatic complexity higher than threshold (JS-R1005)

**Category:** Issue
**Description:**
A function with high cyclomatic complexity can be hard to understand and
maintain. Cyclomatic complexity is a software metric that measures the number of
independent paths through a function. A higher cyclomatic complexity indicates
that the function has more decision points and is more complex.

<!--more-->

Functions with high cyclomatic complexity are more likely to have bugs and be
harder to test. They may lead to reduced code maintainability and increased
development time.

To reduce the cyclomatic complexity of a function, you can:

- Break the function into smaller, more manageable functions.
- Refactor complex logic into separate functions or classes.
- Avoid multiple return paths and deeply nested control expressions.

### Bad Practice

```js
// When `cyclomatic_complexity_threshold` is set to `low`, by default it is `high`
function getCapitalCity(countryName) {
  if (countryName === 'India') {
    return 'New Delhi'
  } else if (countryName === 'China') {
    return 'Beijing'
  } else if (countryName === 'France') {
    return 'Paris'
  } else if (countryName === 'Germany') {
    return 'Berlin'
  } else if (countryName === 'Italy') {
    return 'Rome'
  }
}
```

### Recommended

```js
function getCapitalCity(countryName) {
  const capitalCities = {
    India: 'New Delhi',
    China: 'Beijing',
    France: 'Paris',
    Germany: 'Berlin',
    Italy: 'Rome'
  }

  return capitalCities[countryName]
}
```

### Issue configuration

Cyclomatic complexity threshold can be configured using the
`cyclomatic_complexity_threshold` [meta field](https://docs.deepsource.com/docs/analyzers-javascript#cyclomatic_complexity_threshold) in the
`.deepsource.toml` config file.

Configuring this is optional. If you don't provide a value, the Analyzer will
raise issues for functions with complexity higher than the default threshold,
which is `high`(only raises for issues >25) for the JavaScript Analyzer.

Here's the mapping of the risk category to the cyclomatic complexity score to
help you configure this better:

| Risk category | Cyclomatic complexity range |                                             Recommended action                                             |
| :-----------: | :-------------------------: | :--------------------------------------------------------------------------------------------------------: |
|      low      |             1-5             |                                             No action needed.                                              |
|    medium     |            6-15             |                                            Review and monitor.                                             |
|     high      |            16-25            | Review and refactor. Recommended to add comments if the function is absolutely needed to be kept as it is. |
|   very-high   |            26-50            |                                     Refactor to reduce the complexity.                                     |
|   critical    |             >50             |          Must refactor this. This can make the code untestable and very difficult to understand.           |

**Locations (7):**
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:23` - Function has a cyclomatic complexity of 59 with "critical" risk
- [ ] `whatsapp-web.js/src/structures/Message.js:24` - `_patch` has a cyclomatic complexity of 45 with "very-high" risk
- [ ] `whatsapp-web.js/src/Client.js:949` - `sendMessage` has a cyclomatic complexity of 28 with "very-high" risk
- [ ] `whatsapp-web.js/example.js:67` - Function has a cyclomatic complexity of 72 with "critical" risk
- [ ] `services/wa-client/src/index.ts:1851` - `handleAdminCommand` has a cyclomatic complexity of 45 with "very-high" risk
- [ ] `services/scan-orchestrator/src/index.ts:943` - Function has a cyclomatic complexity of 99 with "critical" risk
- [ ] `packages/shared/src/scoring.ts:39` - `scoreFromSignals` has a cyclomatic complexity of 35 with "very-high" risk

---

### [DeepSource] Found duplicate assignments (JS-W1032)

**Category:** Issue
**Description:**
Consecutively reassigning to the same variable or property is a code smell and should be avoided.
<!--more-->
It is likely that this is the result of some undeleted code and can have unexpected side effects.
The first assignment is rendered useless by the second and can therefore be removed without observing any changes to the value of the assignment target.

### Bad Practice

```js
a[1] = 'something'
a[1] = 'some other thing'
```

### Recommended

```js
a[1] = 'something'
if (condition()) {
  a[1] = 'some other thing'
}
```

**Locations (3):**
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:336` - Duplicate assignment statement found
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:69` - Duplicate assignment statement found
- [ ] `packages/shared/src/url.ts:22` - Duplicate assignment statement found

---

### [DeepSource] Found control characters in regular expression (JS-W1035)

**Category:** Issue
**Description:**
ASCII character codes between 0 and 32 are reserved for [non-printing characters](https://en.wikipedia.org/wiki/Non-printing_character_in_word_processors).
Such characters are unlikely to be present in JavaScript strings, and matching them with a Regular expression is most likely a mistake.
Even when you do want to match them, it is recommended to use the character literals for better clarity:

```js
const tabsAndSpaces = / \t/
const tabsSpacesAndNewLines = /\s/
```

<!-- more -->

If you find yourself needing to match the hex values for some reason,
consider adding a [skipcq comment](https://docs.deepsource.com/docs/issues-ignore-rules) to inform readers about the use-case.
This will also prevent DeepSource from raising the issue.

### Bad Practice

```js
const rSpaces = /\x1a/;
// A regex like this one is rarely useful:
const regExp  = new RegExp("\x12");
```

### Recommended

```js
const rSpaces = / /;
const regExp  = new RegExp("[\sa-z]+no-control-chars-here");
```

**Locations (1):**
- [ ] `packages/shared/src/homoglyph.ts:25` - Regular expression contains non-printing character

---

### [DeepSource] Found empty block statements (JS-0009)

**Category:** Issue
**Description:**
Empty block statements, while not technically errors, usually occur due to refactoring that wasn't completed.
They can mislead the reader.

<!--more-->

If you still want to keep an empty block, add a comment saying `empty` inside the block.

### Bad Practice

```js
if (someCheck) {}

while (someCheck) {}

try {
    doSomething();
} catch(err) {
} finally {
}
```

### Recommended

```js
if (someCheck) {
    // empty
}

while (someCheck) {
    /* empty */
}

try {
    doSomething();
} catch (err) {
    // continue regardless of error
}

try {
    doSomething();
} finally {
    /* continue regardless of error */
}
```

**Locations (1):**
- [ ] `tests/integration/vt-throttling.test.ts:13` - Empty block statement

---

### [DeepSource] Either all code paths should have explicit returns, or none of them (JS-0045)

**Category:** Issue
**Description:**
Any code paths that do not have explicit returns will return `undefined`.
It is recommended to replace any implicit dead-ends that return `undefined` with a `return null` statement.

As a convention, `undefined` signals that an unexpected value has been produced as the
result of a logical error in the program.
A `null` return, on the other hand, signals that the input to a function was incorrect,
or a value was 'not found'.

Having this distinction in code helps you figure out if something was caused because of a logical error,
or malformed input to a function call.

### Bad Practice

```js
function getUser(name) {
    if (userExists(name)) {
        return userDb.get(name);
    }
    // whoops! Implicit undefined return
}

function readFile(fileName) {
    if (fs.existsSync(fileName)) {
        return fs.readFileSync(fileName, 'utf-8');
    }

    return; // Implicit undefined return.
}
```

### Recommended

```js
function getUser(name) {
    if (userExists(name)) {
        return userDb.get(name);
    }

    // `null` indicates there is no such user.
    return null;
}

function readFile(fileName) {
    if (fs.existsSync(fileName)) {
        return fs.readFileSync(fileName, 'utf-8');
    }

    // `null` indicates there is no such file.
    return null;
}
```

### References

- [Stack Overflow: When is null or undefined used in JavaScript?](https://stackoverflow.com/questions/6429225/when-is-null-or-undefined-used-in-javascript)

**Locations (10):**
- [ ] `whatsapp-web.js/tests/helper.js:19` - Expected to return a value at the end of function 'getSessionFromEnv'
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:908` - Async arrow function expected no return value
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:906` - Async arrow function expected no return value
- [ ] `whatsapp-web.js/src/structures/Message.js:539` - Expected to return a value at the end of async arrow function
- [ ] `whatsapp-web.js/src/structures/Message.js:526` - Expected to return a value at the end of async arrow function
- [ ] `whatsapp-web.js/src/structures/Message.js:410` - Expected to return a value at the end of async arrow function
- [ ] `whatsapp-web.js/src/structures/Chat.js:307` - Async method 'addOrEditCustomerNote' expected no return value
- [ ] `whatsapp-web.js/src/Client.js:2378` - Async arrow function expected no return value
- [ ] `whatsapp-web.js/src/Client.js:1198` - Expected to return a value at the end of async arrow function
- [ ] `whatsapp-web.js/src/Client.js:857` - Expected to return a value at the end of arrow function

---

### [DeepSource] Avoid use of `==` and `!=` (JS-0050)

**Category:** Issue
**Description:**
It is considered good practice to use the type-safe equality operators `===` and `!==` instead of their regular counterparts `==` and `!=`.

<!--more-->

The strict equality operators (`===` and `!==`) use the strict equality comparison algorithm to compare two operands.

- If the operands are of different types, return `false`.
- If both operands are objects, return `true` only if they refer to the same object.
- If both operands are `null` or both operands are `undefined`, return `true`.
- If either operand is `NaN`, return `false`.
- Otherwise, compare the two operand's values:
    - Numbers must have the same numeric values. `+0` and `-0` are considered to be the same value.
    - Strings must have the same characters in the same order.
    - Booleans must be both `true` or both `false`.

The most notable difference between this operator and the equality (`==`) operator is that if the operands are of different types, the `==` operator attempts to convert them to the same type before comparing.

### Bad Practice
```js
a == b
foo == true
bananas != 1
value == undefined
typeof foo == 'undefined'
'hello' != 'world'
0 == 0
true == true
foo == null
```

### Recommended
```js
a === b
foo === true
bananas !== 1
value === undefined
typeof foo === 'undefined'
'hello' !== 'world'
0 === 0
true === true
foo === null
```

**Locations (10):**
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:369` - Expected '===' and instead saw '=='
- [ ] `whatsapp-web.js/src/structures/Message.js:455` - Expected '!==' and instead saw '!='
- [ ] `whatsapp-web.js/src/Client.js:2426` - Expected '!==' and instead saw '!='
- [ ] `whatsapp-web.js/src/Client.js:2088` - Expected '===' and instead saw '=='
- [ ] `whatsapp-web.js/src/Client.js:2081` - Expected '===' and instead saw '=='
- [ ] `whatsapp-web.js/src/Client.js:1710` - Expected '===' and instead saw '=='
- [ ] `whatsapp-web.js/src/Client.js:1331` - Expected '===' and instead saw '=='
- [ ] `whatsapp-web.js/src/Client.js:1230` - Expected '===' and instead saw '=='
- [ ] `whatsapp-web.js/src/Client.js:381` - Expected '!==' and instead saw '!='
- [ ] `whatsapp-web.js/src/Client.js:381` - Expected '!==' and instead saw '!='

---

### [DeepSource] Prefer that `for-in` loops should include an `if` statement (JS-0051)

**Category:** Issue
**Description:**
Looping over objects with a `for in` loop will include properties that are inherited through the prototype chain.
This behavior can lead to unexpected keys in your for loop.

### Bad Practice
```js
for (const key in foo) {
    doSomething(key);
}
```

### Recommended
```js
for (const key in foo) {
    if (Object.prototype.hasOwnProperty.call(foo, key)) {
        doSomething(key);
    }
}

for (const key of Object.keys(foo)) {
    doSomething(key);
}
```

**Locations (2):**
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:119` - Wrap the body of a for-in loop in an if statement with a hasOwnProperty guard
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:106` - Wrap the body of a for-in loop in an if statement with a hasOwnProperty guard

---

### [DeepSource] Avoid using lexical declarations in case clauses (JS-0054)

**Category:** Issue
**Description:**
Declarations in switch cases are visible to all blocks.
It is recommended not to have such declarations.

<!--more-->

Writing lexical declarations (`let`, `const`, `function` and `class`) within `case`/`default` clauses is not a good practice.
Such declarations are hoisted into the scope of the entire switch expression, meaning they are visible to all `case` clauses in that `switch` block.
Though the declaration is visible to all cases, it is only initialized in the clause that it was declared in.
It will be `undefined` if used in any other clause.

To ensure that the lexical declaration only applies to the current case clause, wrap your clauses in blocks.

### Bad Practice

```js
switch (points) {
    case 1:
        let x = 1;
        break;
    case 2:
        const y = 2;
        break;
    case 3:
        function f() {}
        break;
    default:
        class C {}
}
```

### Recommended

```js
// Declarations outside switch-statements are valid
const a = 0;

switch (points) {
    // The following case clauses are wrapped into blocks using brackets
    case 1: {
        let x = 1;
        break;
    }
    case 2: {
        const y = 2;
        break;
    }
    case 3: {
        function f() {}
        break;
    }
    case 4:
        // Declarations using var without brackets are valid due to function-scope hoisting
        var z = 4;
        break;
    default: {
        class C {}
    }
}
```

**Locations (4):**
- [ ] `scripts/deepsource-api.js:306` - Unexpected lexical declaration in case block
- [ ] `scripts/deepsource-api.js:301` - Unexpected lexical declaration in case block
- [ ] `scripts/deepsource-api.js:296` - Unexpected lexical declaration in case block
- [ ] `scripts/deepsource-api.js:291` - Unexpected lexical declaration in case block

---

### [DeepSource] Found empty functions (JS-0057)

**Category:** Issue
**Description:**
Having empty functions hurts readability, and is considered a code-smell.
There's almost always a way to avoid using them.
If you must use one, consider adding a comment to inform the reader of its purpose.

### Bad Practice

```ts
getUser('SwaGaLisTiQuE', () => {})

function f() {}
```

### Recommended

```ts
getUser('SwaGaLisTiQuE', () => {
    // empty because <reason>
})

function f() {
    // intentionally empty. <reason>
}
```

**Locations (10):**
- [ ] `whatsapp-web.js/src/webCache/WebCache.js:6` - Unexpected empty async method 'persist'
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:197` - Unexpected empty arrow function
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:195` - Unexpected empty arrow function
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:151` - Unexpected empty arrow function
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:132` - Unexpected empty arrow function
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:118` - Unexpected empty arrow function
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:87` - Unexpected empty arrow function
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:24` - Unexpected empty async method 'logout'
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:23` - Unexpected empty async method 'destroy'
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:22` - Unexpected empty async method 'disconnect'

---

### [DeepSource] Usage of comma operators should be avoided (JS-0090)

**Category:** Issue
**Description:**
The comma operator includes multiple expressions where only one is expected. It evaluates each operand from left to right and returns the value of the last operand. However, this frequently obscures side effects, and its use is often an accident. Here are some examples of sequences:

<!--more-->

### Bad Practice

```js
let a = (3, 5); // a = 5
a = b += 5, a + b;
while (a = next(), a && a.length);
(0, eval)("doSomething();");
res = doSomething(), val;
0, eval("doSomething();");
do {} while (doSomething(), !!test);
for (; doSomething(), !!test; );
if (doSomething(), !!test);
switch (val = func(), val) {}
while (val = func(), val < 42);
with (doSomething(), val) {}
```

### Recommended

```js
res = (doSomething(), val);
(0, eval)("doSomething();");
do {} while ((doSomething(), !!test));
for (i = 0, j = 10; i < j; i++, j--);
if ((doSomething(), !!test));
switch ((val = func(), val)) {}
while ((val = func(), val < 42));
with ((doSomething(), val)) {}
```

**Locations (2):**
- [ ] `whatsapp-web.js/src/Client.js:1000` - Unexpected use of comma operator
- [ ] `whatsapp-web.js/src/Client.js:995` - Unexpected use of comma operator

---

### [DeepSource] Audit: Starting a process with a partial executable path (BAN-B607)

**Category:** Issue
**Description:**
Python possesses many mechanisms to invoke an external executable. If the desired executable path is not fully qualified relative to the filesystem root then this may present a potential security risk.

<!--more-->
In POSIX environments, the PATH environment variable is used to specify a set of standard locations that will be searched for the first matching named executable. While convenient, this behavior may allow a malicious actor to exert control over a system. If they are able to adjust the contents of the PATH variable, or manipulate the file system, then a bogus executable may be discovered in place of the desired one. This executable will be invoked with the user privileges of the Python process that spawned it, potentially a highly privileged user.

This test will scan the parameters of all configured Python methods, looking for paths that do not start at the filesystem root, that is, do not have a leading ‘/’ character.

### Bad practice
```python
import subprocess

subprocess.run(['calculator', '-u', 'critical', msg], check=True) # Sensitive, Path not qualified from root
```

### Recommended
```python
import subprocess

subprocess.run(['/usr/bin/calculator', '-u', 'critical', msg], check=True) # Path qualified from root
```

## References:
- [Bandit B607](https://bandit.readthedocs.io/en/latest/plugins/b607_start_process_with_partial_path.html#b607-start-process-with-partial-path)
- OWASP Top 10 2021 Category A03 - [Injection](https://owasp.org/Top10/A03_2021-Injection/)

**Locations (9):**
- [ ] `scripts/agent_orchestrator/main.py:515` - Starting a process with a partial executable path
- [ ] `scripts/agent_orchestrator/main.py:506` - Starting a process with a partial executable path
- [ ] `scripts/agent_orchestrator/main.py:497` - Starting a process with a partial executable path
- [ ] `scripts/agent_orchestrator/main.py:481` - Starting a process with a partial executable path
- [ ] `scripts/agent_orchestrator/main.py:465` - Starting a process with a partial executable path
- [ ] `scripts/agent_orchestrator/main.py:452` - Starting a process with a partial executable path
- [ ] `scripts/agent_orchestrator/main.py:446` - Starting a process with a partial executable path
- [ ] `scripts/agent_orchestrator/main.py:441` - Starting a process with a partial executable path
- [ ] `scripts/agent_orchestrator/main.py:418` - Starting a process with a partial executable path

---

### [DeepSource] Use `WORKDIR` to switch to a directory (DOK-DL3003)

**Category:** Issue
**Description:**
Only use `cd` in a subshell. Most commands can work with absolute paths and in most cases, it is not necessary to change directories. Docker provides the `WORKDIR` instruction if you really need to change the current working directory. 

<!--more-->

Also note that any changes to the environment or working directory within a `RUN` command will not stay in effect in subsequent lines.

### Bad Practice

```dockerfile
FROM debian:buster
RUN cd /usr/src/app && git clone git@github.com:lukasmartinelli/hadolint.git
```

### Recommended

```dockerfile
FROM debian:buster
WORKDIR /usr/src/app
RUN git clone git@github.com:lukasmartinelli/hadolint.git
```

**Locations (9):**
- [ ] `services/wa-client/Dockerfile:26` - Use WORKDIR to switch to a directory
- [ ] `services/wa-client/Dockerfile:21` - Use WORKDIR to switch to a directory
- [ ] `services/wa-client/Dockerfile:14` - Use WORKDIR to switch to a directory
- [ ] `services/scan-orchestrator/Dockerfile:21` - Use WORKDIR to switch to a directory
- [ ] `services/scan-orchestrator/Dockerfile:16` - Use WORKDIR to switch to a directory
- [ ] `services/scan-orchestrator/Dockerfile:10` - Use WORKDIR to switch to a directory
- [ ] `services/control-plane/Dockerfile:21` - Use WORKDIR to switch to a directory
- [ ] `services/control-plane/Dockerfile:16` - Use WORKDIR to switch to a directory
- [ ] `services/control-plane/Dockerfile:10` - Use WORKDIR to switch to a directory

---

### [DeepSource] Throwing literals as exceptions is not recommended (JS-0091)

**Category:** Issue
**Description:**
It is considered good practice to only `throw` the `Error` object itself or an object using the `Error` object as base objects for user-defined exceptions.
The benefit of `Error` objects is that they automatically keep track of where they were built and originated.
This rule restricts what can be thrown as an exception.

### Bad Practice
```js
throw "error";

throw 0;

throw undefined;

throw null;

var err = new Error();
throw "an " + err;
// err is recast to a string literal

var err = new Error();
throw `${err}`
```

### Recommended

```js
throw new Error();

throw new Error("error");

var e = new Error("error");
throw e;

try {
    throw new Error("error");
} catch (e) {
    throw e;
}
```

**Locations (10):**
- [ ] `whatsapp-web.js/tests/helper.js:17` - Expected an error object to be thrown
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:784` - Expected an error object to be thrown
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:214` - Expected an error object to be thrown
- [ ] `whatsapp-web.js/src/structures/List.js:66` - Expected an error object to be thrown
- [ ] `whatsapp-web.js/src/structures/List.js:62` - Expected an error object to be thrown
- [ ] `whatsapp-web.js/src/structures/List.js:60` - Expected an error object to be thrown
- [ ] `whatsapp-web.js/src/structures/List.js:59` - Expected an error object to be thrown
- [ ] `whatsapp-web.js/src/structures/Buttons.js:61` - Expected an error object to be thrown
- [ ] `whatsapp-web.js/src/Client.js:2426` - Expected an error object to be thrown
- [ ] `whatsapp-web.js/src/Client.js:2079` - Expected an error object to be thrown

---

### [DeepSource] Found unnecessary escape characters (JS-0097)

**Category:** Issue
**Description:**
Escaping non-special characters in strings, template literals, and regular expressions doesn't have any effect.

<!--more-->

### Bad Practice

```js
"\'";
'\"';
"\#";
"\e";
`\"`;
`\"${foo}\"`;
`\#{foo}`;
/\!/;
/\@/;
```

### Recommended

```js
"\"";
'\'';
"\x12";
"\u00a9";
"\371";
"xs\u2111";
`\``;
`\${${foo}}`;
`$\{${foo}}`;
/\/g;
/\t/g;
/\w\$\*\^\./;
```

**Locations (2):**
- [ ] `scripts/export-wwebjs-docs.mjs:36` - Unnecessary escape character: \/
- [ ] `packages/shared/src/url.ts:13` - Unnecessary escape character: \[

---

### [DeepSource] Void operators found (JS-0098)

**Category:** Issue
**Description:**
The void operator takes an operand and returns undefined. It can be used to ignore the value produced by an expression. 
However, this can lead to code that is difficult to understand and maintain. 
Historically, the void operator was used to get a "pure" undefined value, as the undefined variable was mutable prior to ES5. 
Nowadays, this is no longer necessary as undefined is immutable in modern JavaScript.

### Bad Practice

```js
// will always return undefined
(function(){
    return void 0;
})();
```

### Recommended

```js
// Use explicit undefined
(function(){
    return undefined;
})();
```

**Locations (10):**
- [ ] `tests/integration/stubs/bottleneck.ts:28` - Expected 'undefined' and instead saw 'void'
- [ ] `services/wa-client/src/pairingOrchestrator.ts:133` - Expected 'undefined' and instead saw 'void'
- [ ] `services/wa-client/src/index.ts:1130` - Expected 'undefined' and instead saw 'void'
- [ ] `services/wa-client/src/index.ts:976` - Expected 'undefined' and instead saw 'void'
- [ ] `services/wa-client/src/index.ts:856` - Expected 'undefined' and instead saw 'void'
- [ ] `packages/shared/src/url-shortener.ts:246` - Expected 'undefined' and instead saw 'void'
- [ ] `packages/shared/src/url-shortener.ts:241` - Expected 'undefined' and instead saw 'void'
- [ ] `packages/shared/src/url-shortener.ts:238` - Expected 'undefined' and instead saw 'void'
- [ ] `packages/shared/src/url-shortener.ts:229` - Expected 'undefined' and instead saw 'void'
- [ ] `packages/shared/src/url-shortener.ts:222` - Expected 'undefined' and instead saw 'void'

---

### [DeepSource] Prefer var declarations be placed at the top of their scope (JS-0102)

**Category:** Issue
**Description:**
Declare variables at the top of their scope as it improves code readability, performance and also helps in code navigation.

<!--more-->

The `vars-on-top` rule generates warnings when variable declarations are not used serially at the top of a function scope or the top of a program. By default variable declarations are always moved (“hoisted”) invisibly to the top of their containing scope by the JavaScript interpreter. This rule forces the programmer to represent that behavior by manually moving the variable declaration to the top of its containing scope.

### Bad Practice
```js
// Variable declarations in a block:
function doSomething() {
    var first;
    if (true) {
        first = true;
    }
    var second;
}

// Variable declaration in for initializer:
function doSomething() {
    for (var i=0; i<10; i++) {}
}
```

### Recommended
```js
function doSomething() {
    var first;
    var second; //multiple declarations are allowed at the top
    if (true) {
        first = true;
    }
}

function doSomething() {
    var i;
    for (i=0; i<10; i++) {}
}
```

**Locations (6):**
- [ ] `whatsapp-web.js/src/util/Util.js:23` - All 'var' declarations must be at the top of the function scope
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:714` - All 'var' declarations must be at the top of the function scope
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:98` - All 'var' declarations must be at the top of the function scope
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:7` - All 'var' declarations must be at the top of the function scope
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:6` - All 'var' declarations must be at the top of the function scope
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:5` - All 'var' declarations must be at the top of the function scope

---

### [DeepSource] Class methods should utilize `this` (JS-0105)

**Category:** Issue
**Description:**
If a class method does not use `this`, it can sometimes be made into a static function. If you do convert the method into a static function, instances of the class that call that particular method have to be converted to a static call as well `(MyClass.callStaticMethod())`

### Bad Practice

```javascript
class Person {
  sayHi() {
    const greeting = document.createElement("div");
    greeting.innerText = "Hello!";
    document.appendChild();
  }
}

const person = new Person();
person.sayHi();
```

### Recommended

```javascript
class Person {
  static sayHi() {
    const greeting = document.createElement("div");
    greeting.innerText = "Hello!";
    document.appendChild();
  }
}

Person.sayHi();
```

**Locations (10):**
- [ ] `whatsapp-web.js/src/webCache/WebCache.js:6` - Expected 'this' to be used by class async method 'persist'
- [ ] `whatsapp-web.js/src/webCache/WebCache.js:5` - Expected 'this' to be used by class async method 'resolve'
- [ ] `whatsapp-web.js/src/webCache/RemoteWebCache.js:35` - Expected 'this' to be used by class async method 'persist'
- [ ] `whatsapp-web.js/src/structures/ScheduledEvent.js:54` - Expected 'this' to be used by class method '_validateInputs'
- [ ] `whatsapp-web.js/src/structures/List.js:58` - Expected 'this' to be used by class method '_format'
- [ ] `whatsapp-web.js/src/structures/Buttons.js:73` - Expected 'this' to be used by class method '_format'
- [ ] `whatsapp-web.js/src/structures/Base.js:19` - Expected 'this' to be used by class method '_patch'
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:219` - Expected 'this' to be used by class async method 'delay'
- [ ] `whatsapp-web.js/src/authStrategies/RemoteAuth.js:210` - Expected 'this' to be used by class async method 'isValidPath'
- [ ] `whatsapp-web.js/src/authStrategies/BaseAuthStrategy.js:24` - Expected 'this' to be used by class async method 'logout'

---

### [DeepSource] `async function` should have `await` expression (JS-0116)

**Category:** Issue
**Description:**
A function that does not contain any `await` expressions should not be `async` (except for some edge cases
in TypeScript which are discussed below).
Asynchronous functions in JavaScript behave differently than other functions in two important ways:

- The return value is always a `Promise`.
- You can use the `await` operator inside them.

Functions are made `async` so that we can use the `await` operator inside them.
Consider this example:

```js
async function fetchData(processDataItem) {
    const response = await fetch(DATA_URL);
    const data = await response.json();

    return data.map(processDataItem);
}
```

Asynchronous functions that don't use `await` might be an unintentional result of refactoring.

Note: This issue ignores async generator functions.
Generators `yield` rather than `return` a value and `async` generators might yield all the values of another async generator without ever actually needing to use `await`.

In TypeScript, one might feel the need to make a function `async` to comply with type signatures defined by an interface.
Ideally, the code should be refactored to get rid of such restrictions, but sometimes that isn't feasible
(For example, when we are implementing an interface defined in a 3rd party library like Next.js).

This situation can easily be circumvented by returning the value with a call to `Promise.resolve`:

```ts
interface HasAsyncFunc {
  getNum: () => Promise<number>
}

// Not recommended:
const o: HasAsyncFunc = {
  async getNum() { return 1 }
}

// Recommended:
const o: HasAsyncFunc = {
  // We only use `Promise.resolve` to adhere to the type
  // of the surrounding object.
  getNum() { return Promise.resolve(1) }
}
```

It is also advised to add a comment near the redundant promise to make the intent clear.

### Bad Practice

```js
async function fetchData(): string {
    // `readFileSync` is a synchronous function that blocks
    // the main thread, and thus does not need to be `await`ed
    return fs.readFileSync("data.txt", "utf-8");
}

performAction(async () => { console.log("no awaits in here") });
```

### Recommended

```js
async function fetchDataAsync(): Promise<string> {
  return await fs.readFile("data.txt", "utf-8")
}

performAction(async () => { await writeToFile(data) });

// Allow empty functions.
async function no_op() {}
```

**Locations (10):**
- [ ] `whatsapp-web.js/src/webCache/WebCache.js:5` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/webCache/LocalWebCache.js:32` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/webCache/LocalWebCache.js:20` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/util/Util.js:55` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:812` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/util/Injected/Utils.js:710` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Message.js:436` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Message.js:391` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/Label.js:44` - Found `async` function without any `await` expressions
- [ ] `whatsapp-web.js/src/structures/GroupNotification.js:98` - Found `async` function without any `await` expressions

---

### [DeepSource] Initialization in variable declarations against recommended approach (JS-0119)

**Category:** Issue
**Description:**
In JavaScript, variables can be assigned during declaration, or at any point afterwards using an assignment statement. For example, in the following code, `foo` is initialized during declaration, while `bar` is initialized later.

```js
var foo = 1;
var bar;

if (foo) {
    bar = 1;
} else {
    bar = 2;
}
```

### Bad Practice

```js
function foo() {
    var bar;
    let baz;
}
```

### Recommended

```js
function foo() {
    var bar = 1;
    let baz = 2;
    const qux = 3;
}
```

**Locations (10):**
- [ ] `whatsapp-web.js/tests/structures/message.js:51` - Variable 'replyMsg' should be initialized on declaration
- [ ] `whatsapp-web.js/tests/structures/message.js:12` - Variable 'message' should be initialized on declaration
- [ ] `whatsapp-web.js/tests/structures/message.js:11` - Variable 'chat' should be initialized on declaration
- [ ] `whatsapp-web.js/tests/structures/message.js:10` - Variable 'client' should be initialized on declaration
- [ ] `whatsapp-web.js/tests/structures/group.js:195` - Variable 'code' should be initialized on declaration
- [ ] `whatsapp-web.js/tests/structures/group.js:8` - Variable 'group' should be initialized on declaration
- [ ] `whatsapp-web.js/tests/structures/group.js:7` - Variable 'client' should be initialized on declaration
- [ ] `whatsapp-web.js/tests/structures/chat.js:12` - Variable 'chat' should be initialized on declaration
- [ ] `whatsapp-web.js/tests/structures/chat.js:11` - Variable 'client' should be initialized on declaration
- [ ] `whatsapp-web.js/tests/client.js:655` - Variable 'me' should be initialized on declaration

---

### [DeepSource] Local variable name shadows variable in outer scope (JS-0123)

**Category:** Issue
**Description:**
Two variables can have the same name if they're declared in different scopes.
In the example below, the parameter `x` is said to "shadow" the variable `x` declared above it.
The outer `x` can no longer be accessed inside the `sum` function.

```js
const x = 1
function add(x, y) {
    return x + y
}
```

While shadowing does not cause any problems most of the time, it does make the code harder to read and understand.
We highly recommend against shadowing.
However, if you want to shadow some variable name and don't want DeepSource to flag it, add a [skipcq comment](https://docs.deepsource.com/docs/issues-ignore-rules) alongside an explanation:

```js
const x = 1
function add(x, y) { // skipcq: JS-0123 - `x` can be safely shadowed
    return x + y
}
```

If you want to disable this issue project-wide, you can add it to the list of disabled issues in the project dashboard.

### Bad Practice

```js
const file = "data.txt"

function readFile(file) {
    // The parameter `file` shadows the toplevel variable `file`.
    if (fs.existsSync(file)) {
        return fs.readFileSync(file)
    }
    return null
}
```

### Recommended

```js
// Prefer variable names that are distinct and convey as much
// meaning as possible.
const dataFile = "data.txt"

function readFile(filePath) {
    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath)
    }
    return null
}
```

Alternatively:

```js
const file = "data.txt"

function readFile(file) { // skipcq: JS-0123 - Shadowing is safe here
    // ...
}
```

**Locations (10):**
- [ ] `whatsapp-web.js/tests/structures/message.js:31` - 'chat' is already declared in the upper scope on line 11 column 9
- [ ] `whatsapp-web.js/tests/client.js:354` - 'expectedModules' is already declared in the upper scope on line 306 column 23
- [ ] `whatsapp-web.js/src/util/Util.js:181` - 'path' is already declared in the upper scope on line 3 column 7
- [ ] `whatsapp-web.js/src/util/Util.js:63` - 'media' is already declared in the upper scope on line 55 column 43
- [ ] `whatsapp-web.js/src/util/Puppeteer.js:14` - 'name' is already declared in the upper scope on line 13 column 45
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:117` - 'features' is already declared in the upper scope on line 116 column 27
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:104` - 'features' is already declared in the upper scope on line 103 column 26
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:93` - 'feature' is already declared in the upper scope on line 92 column 30
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:63` - 'msgId' is already declared in the upper scope on line 62 column 29
- [ ] `whatsapp-web.js/src/util/InterfaceController.js:50` - 'msgId' is already declared in the upper scope on line 49 column 28

---

## LOW Priority Issues (47)

### [SonarQube] Using http protocol is insecure. Use https instead. (typescript:S5332)

**Category:** Security Hotspot
**Description:**
Using http protocol is insecure. Use https instead.

**Locations (13):**
- [ ] `packages/shared/src/config.ts:142` - Using http protocol is insecure. Use https instead.
- [ ] `services/wa-client/src/index.ts:755` - Using http protocol is insecure. Use https instead.
- [ ] `tests/e2e/admin-commands.test.ts:24` - Using http protocol is insecure. Use https instead.
- [ ] `tests/e2e/control-plane.test.ts:154` - Using http protocol is insecure. Use https instead.
- [ ] `tests/integration/shortener-fallback.test.ts:78` - Using http protocol is insecure. Use https instead.
- [ ] `tests/integration/shortener-fallback.test.ts:96` - Using http protocol is insecure. Use https instead.
- [ ] `tests/integration/shortener-fallback.test.ts:118` - Using http protocol is insecure. Use https instead.
- [ ] `tests/integration/shortener-fallback.test.ts:155` - Using http protocol is insecure. Use https instead.
- [ ] `tests/integration/shortener-fallback.test.ts:189` - Using http protocol is insecure. Use https instead.
- [ ] `tests/integration/shortener-fallback.test.ts:203` - Using http protocol is insecure. Use https instead.
- [ ] `tests/integration/shortener-fallback.test.ts:210` - Using http protocol is insecure. Use https instead.
- [ ] `tests/integration/shortener-fallback.test.ts:224` - Using http protocol is insecure. Use https instead.
- [ ] `tests/integration/shortener-fallback.test.ts:231` - Using http protocol is insecure. Use https instead.

---

### [SonarQube] Make sure using a hardcoded IP address 10.0.0.1 is safe here. (typescript:S1313)

**Category:** Security Hotspot
**Description:**
Make sure using a hardcoded IP address 10.0.0.1 is safe here.

**Locations (21):**
- [ ] `packages/shared/src/__tests__/ssrf.test.ts:15` - Make sure using a hardcoded IP address 10.0.0.1 is safe here.
- [ ] `packages/shared/src/__tests__/ssrf.test.ts:16` - Make sure using a hardcoded IP address 172.16.5.2 is safe here.
- [ ] `packages/shared/src/__tests__/ssrf.test.ts:17` - Make sure using a hardcoded IP address 192.168.1.10 is safe here.
- [ ] `packages/shared/src/__tests__/ssrf.test.ts:18` - Make sure using a hardcoded IP address 8.8.8.8 is safe here.
- [ ] `packages/shared/src/__tests__/ssrf.test.ts:23` - Make sure using a hardcoded IP address fc00::1 is safe here.
- [ ] `packages/shared/src/__tests__/ssrf.test.ts:24` - Make sure using a hardcoded IP address 2001:4860:4860::8888 is safe here.
- [ ] `packages/shared/src/__tests__/ssrf.test.ts:28` - Make sure using a hardcoded IP address 192.168.1.5 is safe here.
- [ ] `packages/shared/src/__tests__/ssrf.test.ts:31` - Make sure using a hardcoded IP address 8.8.8.8 is safe here.
- [ ] `packages/shared/src/reputation/dns-intelligence.ts:211` - Make sure using a hardcoded IP address 8.8.8.8 is safe here.
- [ ] `packages/shared/src/reputation/dns-intelligence.ts:211` - Make sure using a hardcoded IP address 1.1.1.1 is safe here.
- [ ] `packages/shared/src/ssrf.ts:5` - Make sure using a hardcoded IP address 10.0.0.0/8 is safe here.
- [ ] `packages/shared/src/ssrf.ts:6` - Make sure using a hardcoded IP address 172.16.0.0/12 is safe here.
- [ ] `packages/shared/src/ssrf.ts:7` - Make sure using a hardcoded IP address 192.168.0.0/16 is safe here.
- [ ] `packages/shared/src/ssrf.ts:9` - Make sure using a hardcoded IP address 169.254.0.0/16 is safe here.
- [ ] `packages/shared/src/ssrf.ts:11` - Make sure using a hardcoded IP address fc00::/7 is safe here.
- [ ] `packages/shared/src/ssrf.ts:12` - Make sure using a hardcoded IP address fe80::/10 is safe here.
- [ ] `tests/integration/shortener-fallback.test.ts:32` - Make sure using a hardcoded IP address 93.184.216.34 is safe here.
- [ ] `tests/integration/shortener-fallback.test.ts:52` - Make sure using a hardcoded IP address 93.184.216.34 is safe here.
- [ ] `tests/integration/shortener-fallback.test.ts:62` - Make sure using a hardcoded IP address 93.184.216.34 is safe here.
- [ ] `tests/integration/shortener-fallback.test.ts:113` - Make sure using a hardcoded IP address 93.184.216.34 is safe here.
- [ ] `tests/integration/shortener-fallback.test.ts:184` - Make sure using a hardcoded IP address 93.184.216.34 is safe here.

---

### [SonarQube] Make sure the "PATH" variable only contains fixed, unwriteable directories. (javascript:S4036)

**Category:** Security Hotspot
**Description:**
Make sure the "PATH" variable only contains fixed, unwriteable directories.

**Locations (3):**
- [ ] `scripts/watch-pairing-code.js:62` - Make sure the "PATH" variable only contains fixed, unwriteable directories.
- [ ] `scripts/watch-pairing-code.js:64` - Make sure the "PATH" variable only contains fixed, unwriteable directories.
- [ ] `scripts/watch-pairing-code.js:107` - Make sure the "PATH" variable only contains fixed, unwriteable directories.

---

### [SonarQube] Make sure the "PATH" variable only contains fixed, unwriteable directories. (typescript:S4036)

**Category:** Security Hotspot
**Description:**
Make sure the "PATH" variable only contains fixed, unwriteable directories.

**Locations (1):**
- [ ] `tests/integration/setup-wizard.test.ts:10` - Make sure the "PATH" variable only contains fixed, unwriteable directories.

---

### [SonarQube] Omitting "--ignore-scripts" can lead to the execution of shell scripts. Make sure it is safe here. (docker:S6505)

**Category:** Security Hotspot
**Description:**
Omitting "--ignore-scripts" can lead to the execution of shell scripts. Make sure it is safe here.

**Locations (9):**
- [ ] `services/control-plane/Dockerfile:11` - Omitting "--ignore-scripts" can lead to the execution of shell scripts. Make sure it is safe here.
- [ ] `services/control-plane/Dockerfile:17` - Omitting "--ignore-scripts" can lead to the execution of shell scripts. Make sure it is safe here.
- [ ] `services/control-plane/Dockerfile:18` - Omitting "--ignore-scripts" can lead to the execution of shell scripts. Make sure it is safe here.
- [ ] `services/scan-orchestrator/Dockerfile:11` - Omitting "--ignore-scripts" can lead to the execution of shell scripts. Make sure it is safe here.
- [ ] `services/scan-orchestrator/Dockerfile:17` - Omitting "--ignore-scripts" can lead to the execution of shell scripts. Make sure it is safe here.
- [ ] `services/scan-orchestrator/Dockerfile:18` - Omitting "--ignore-scripts" can lead to the execution of shell scripts. Make sure it is safe here.
- [ ] `services/wa-client/Dockerfile:15` - Omitting "--ignore-scripts" can lead to the execution of shell scripts. Make sure it is safe here.
- [ ] `services/wa-client/Dockerfile:22` - Omitting "--ignore-scripts" can lead to the execution of shell scripts. Make sure it is safe here.
- [ ] `services/wa-client/Dockerfile:23` - Omitting "--ignore-scripts" can lead to the execution of shell scripts. Make sure it is safe here.

---

