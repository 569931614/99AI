
/**
 * 由 Fantastic-admin 提供技术支持
 * Powered by Fantastic-admin
 * https://fantastic-admin.github.io
 */

import{l as t}from"./index-DGiiYem6.js";const e={enroll:e=>t.post("voice/enroll",e),listGptSovitsFiles:()=>t.get("voice/gpt-sovits/files"),importGptSovits:e=>t.post("voice/gpt-sovits/import",e),uploadGptSovitsModel:e=>{const o=new FormData;return o.append("file",e),t.post("voice/gpt-sovits/models/upload",o,{headers:{"Content-Type":"multipart/form-data"},timeout:6e5})},listGptSovitsLibrary:()=>t.get("voice/gpt-sovits/files"),list:(e={})=>t.get("voice/list",{params:e}),listGptSovitsCharacters:()=>t.get("voice/gpt-sovits/characters"),getGptSovitsCharacterInfo:e=>t.get(`voice/gpt-sovits/character/${encodeURIComponent(e)}`),detail:e=>t.get(`voice/detail/${encodeURIComponent(e)}`),update:e=>t.post("voice/update",e),remove:e=>t.post("voice/delete",e),preview:e=>t.post("open/voice/preview",e),getParams:e=>t.get(`voice/params/${encodeURIComponent(e)}`),setParams:e=>t.post("voice/params",e),getMeta:e=>t.get(`voice/meta/${encodeURIComponent(e)}`),setMeta:e=>t.post("voice/meta",e),setCategory:e=>t.post("voice/category",e),syncPendingStatus:()=>t.post("voice/sync-pending-status")};export{e as A};
