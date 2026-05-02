---
title: "Hello Hugo · 测试文"
date: 2026-05-02T19:30:00+08:00
draft: false
tags: ["meta", "hugo"]
categories: ["杂"]
description: "建站第一篇，用来检验各种元素的渲染效果。"
ShowToc: true
TocOpen: true
---

> 这是建站后写的第一篇，专门用来确认代码块、引用、列表、链接、图片等元素都能正常渲染。看完没问题就可以删掉。

## 二级标题

正文段落。这里是普通文字，**加粗**、*斜体*、`行内代码`、[超链接](https://gohugo.io) 都试一下。

### 代码块

```cpp
// C++ 代码块测试
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
# 命令行高亮测试
hugo server -D --bind 0.0.0.0
```

### 引用块

> "楼可以改得不高，但不能在已经改好的地方千疮百孔。"
> —— 自己

### 列表

无序：

- 项目 A
- 项目 B
  - 嵌套
  - 嵌套
- 项目 C

有序：

1. 第一步
2. 第二步
3. 第三步

### 表格

| 项 | 值 | 说明 |
|---|---|---|
| 框架 | Hugo | 单二进制，Go |
| 主题 | PaperMod | tech blog 主流 |
| 部署 | GH Pages + Actions | 推源码自动构建 |

### 分隔线下面是结尾

---

如果你看到上面所有元素都正常显示了，说明本地预览这一步通了。下一步是把站点推到 GitHub。
