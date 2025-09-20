
/**
 * 由 Fantastic-admin 提供技术支持
 * Powered by Fantastic-admin
 * https://fantastic-admin.github.io
 */

import{a6 as e}from"./index-BdVS_hFb.js";const o={enroll:o=>e.post("voice/enroll",o),list:(o={})=>e.get("voice/list",{params:o}),detail:o=>e.get(`voice/detail/${encodeURIComponent(o)}`),update:o=>e.post("voice/update",o),remove:o=>e.post("voice/delete",o),preview:o=>e.post("voice/preview",o),getParams:o=>e.get(`voice/params/${encodeURIComponent(o)}`),setParams:o=>e.post("voice/params",o)};export{o as A};
