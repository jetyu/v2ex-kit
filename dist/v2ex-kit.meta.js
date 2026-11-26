// ==UserScript==
// @name         V2EX Kit
// @namespace    https://github.com/jetyu/v2ex-kit
// @version      1.3.10
// @description  Improve V2EX reading and replies with themes, previews, tags, check-in and image uploads.
// @description:zh-CN  让 V2EX 更好用，提供主题切换、帖子预览、用户标签、自动签到和图片上传等实用功能。
// @author       jetyu
// @license      MIT
// @homepageURL  https://github.com/jetyu/v2ex-kit
// @supportURL   https://github.com/jetyu/v2ex-kit/issues
// @icon         https://raw.githubusercontent.com/jetyu/v2ex-kit/main/assets/v2ex-kit.png
// @downloadURL  https://raw.githubusercontent.com/jetyu/v2ex-kit/main/dist/v2ex-kit.user.js
// @updateURL    https://raw.githubusercontent.com/jetyu/v2ex-kit/main/dist/v2ex-kit.meta.js
// @match        https://v2ex.com/*
// @match        https://*.v2ex.com/*
// @noframes
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addValueChangeListener
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      api.imgur.com
// @connect      catbox.moe
// @resource     v2ex-kit-theme-plus-emerald https://raw.githubusercontent.com/jetyu/v2ex-kit/main/src/themes/plus-emerald.css?v=1.3.10
// @resource     v2ex-kit-theme-geist https://cdn.jsdelivr.net/gh/yuyinws/v2ex-theme@v1.5.0/v2ex-geist.css
// @resource     v2ex-kit-theme-claude https://cdn.jsdelivr.net/gh/yuyinws/v2ex-theme@v1.5.0/v2ex-claude.css
// @resource     v2ex-kit-theme-platinum https://cdn.jsdelivr.net/gh/yuyinws/v2ex-theme@v1.5.0/v2ex-platinum.css
// @resource     v2ex-kit-theme-still https://cdn.jsdelivr.net/gh/StillNotYet/v2ex-still@v1.0.3/v2ex-still.theme.min.css
// ==/UserScript==
