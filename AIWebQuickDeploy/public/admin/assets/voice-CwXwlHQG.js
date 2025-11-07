
/**
 * 由 Fantastic-admin 提供技术支持
 * Powered by Fantastic-admin
 * https://fantastic-admin.github.io
 */

import{l as e}from"./index-CXyWYkGV.js";const t={enroll:t=>e.post("voice/enroll",t),list:(t={})=>e.get("voice/list",{params:t}),detail:t=>e.get(`voice/detail/${encodeURIComponent(t)}`),update:t=>e.post("voice/update",t),remove:t=>e.post("voice/delete",t),preview:t=>e.post("voice/preview",t),getParams:t=>e.get(`voice/params/${encodeURIComponent(t)}`),setParams:t=>e.post("voice/params",t),getMeta:t=>e.get(`voice/meta/${encodeURIComponent(t)}`),setMeta:t=>e.post("voice/meta",t),setCategory:t=>e.post("voice/category",t),syncPendingStatus:()=>e.post("voice/sync-pending-status")};export{t as A};
