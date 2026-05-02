---
title: "Hello Hugo · Test Post"
date: 2026-05-02T19:30:00+08:00
draft: false
tags: ["meta", "hugo"]
categories: ["misc"]
summary: "First post after the site went up — a sandbox to verify rendering of common elements."
description: "First post after the site went up — a sandbox to verify rendering of common elements."
showTableOfContents: true
---

> First post after the site went up. Used purely as a rendering sandbox: code blocks, blockquotes, lists, tables, links, images. Once everything looks right, this post can be deleted.

## A second-level heading

Plain paragraph. Inline elements: **bold**, *italic*, `inline code`, [a link](https://gohugo.io). Mixed CJK works too: 这一段中文用来验证字体回退。

### Code blocks

```cpp
// C++ rendering check
template <typename T>
class TWeakObjectPtr {
public:
    T* Get() const {
        if (auto* Obj = ObjectItem.GetObject()) {
            return Cast<T>(Obj);
        }
        return nullptr;
    }
private:
    FUObjectItem ObjectItem;
};
```

```bash
# Shell rendering check
hugo server -D --bind 0.0.0.0
```

### Blockquote

> "It's fine to keep the building short — what's not fine is patching what's already finished into a mess."

### Lists

Unordered:

- Item A
- Item B
  - Nested
  - Nested
- Item C

Ordered:

1. First
2. Second
3. Third

### Table

| Item | Value | Notes |
|---|---|---|
| Framework | Hugo | Single Go binary |
| Theme | Blowfish | Card grid + Tailwind v4 |
| Deploy | GH Pages + Actions | Source push triggers build |

### Horizontal rule above the closer

---

If every element above renders correctly, the local sandbox check is done. Next: push to GitHub and verify production deploy.
