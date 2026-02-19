# Contributing to For the Cult API Documentation

Thank you for your interest in improving our API documentation!

---

## How to Contribute

### Reporting Issues

Found a bug, error, or have a suggestion?

1. **Search existing issues** first to avoid duplicates
2. **Open a new issue** with:
   - Clear title describing the problem
   - Steps to reproduce (for bugs)
   - Expected vs actual behavior
   - API endpoint affected
   - Example request/response

**Issue Template:**

```markdown
**Endpoint:** GET /api/products/search
**Problem:** Search returns incorrect results when...
**Expected:** Should return products matching...
**Actual:** Returns...
**Steps to reproduce:**
1. Call GET /api/products/search?q=alpaca
2. ...
```

### Suggesting Features

Have an idea for the API or documentation?

1. Open an issue with label `enhancement`
2. Describe:
   - What problem it solves
   - Proposed solution
   - Use case / example
   - Impact on existing functionality

### Improving Documentation

#### Small Changes (typos, links, clarity)

1. **Fork** the repository
2. **Edit** the file directly on GitHub
3. **Submit PR** with clear description

#### Large Changes (new guides, examples)

1. **Fork** the repository
2. **Create a branch:** `git checkout -b feature/add-rust-example`
3. **Make changes** following our style guide (below)
4. **Test examples** to ensure they work
5. **Commit** with descriptive message
6. **Push** and create Pull Request

---

## Documentation Style Guide

### Writing Style

- **Be concise** -- Developers are busy
- **Use examples** -- Show, don't just tell
- **Active voice** -- "Call the endpoint" not "The endpoint should be called"
- **Present tense** -- "Returns" not "Will return"
- **Second person** -- "You can search" not "One can search"

### Code Examples

**Good:**

```javascript
// Search for products
const products = await api.search('water filter');
console.log(products);
```

**Bad:**

```javascript
const products = await api.search('water filter'); // This searches for products
console.log(products); // This prints the products
```

### Formatting

- **Headers:** Title case (`## This Is a Header`)
- **Code:** Triple backticks with language
- **Lists:** Dash for unordered (`-`), numbers for ordered (`1.`)
- **Links:** Descriptive text (`[API Reference](./openapi.yaml)` not `[click here](./openapi.yaml)`)

---

## Adding Code Examples

### Guidelines

1. **Test it works** -- Run the example yourself
2. **Include dependencies** -- Show imports/installation
3. **Add comments** -- Explain what's happening
4. **Handle errors** -- Show proper error handling
5. **Keep it simple** -- Don't over-engineer

### Supported Languages

We welcome examples in any language! Priority:

1. JavaScript/TypeScript (most common)
2. Python (popular for AI/ML)
3. Go, Rust, Ruby, PHP, Java, etc.

---

## Testing Changes

### Documentation Changes

Before submitting:

- [ ] Check all links work
- [ ] Verify code formatting is correct
- [ ] Spell check
- [ ] Preview markdown rendering

### Code Examples

Before submitting:

- [ ] Code runs without errors
- [ ] API endpoints respond as expected
- [ ] Error handling works properly
- [ ] Example output matches documentation

**Test locally:**

```bash
# JavaScript
node examples/javascript_example.js

# Python
python3 examples/python_example.py
```

---

## Pull Request Process

### 1. Create PR

- **Title:** Clear, descriptive (`Add Rust example for product search`)
- **Description:** What changed and why
- **Link issues:** "Fixes #123" or "Closes #456"

### 2. Review Process

We'll review your PR within 2-3 business days.

### 3. Merge

Once approved, we'll merge and changes go live immediately.

---

## Community Guidelines

- **Assume good intent** -- Everyone wants to help
- **Be patient** -- We're all volunteers
- **Constructive feedback** -- Focus on the code/docs, not the person
- **Inclusive language** -- Everyone is welcome

---

## Getting Help

- **GitHub Issues:** Open an issue
- **Email:** dev@forthecult.store

---

## License

By contributing, you agree that your contributions will be licensed under the same license as this project (MIT for documentation).

---

Thank you for making For the Cult API better for everyone!
