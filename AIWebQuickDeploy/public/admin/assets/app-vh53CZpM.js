
/**
 * 由 Fantastic-admin 提供技术支持
 * Powered by Fantastic-admin
 * https://fantastic-admin.github.io
 */

import{l as p}from"./index-UxM1epZ2.js";const t={queryCats:t=>p.get("app/queryAppCats",{params:t}),deleteCats:t=>p.post("app/delAppCats",t),createCats:t=>p.post("app/createAppCats",t),updateCats:t=>p.post("app/updateAppCats",t),queryApp:t=>p.get("app/queryApp",{params:t}),deleteApp:t=>p.post("app/delApp",t),createApp:t=>p.post("app/createApp",t),updateApp:t=>p.post("app/updateApp",t),getGlobalEmotions:()=>p.get("app/emotions"),setGlobalEmotions:t=>p.post("app/emotions",t),getAppEmotionVoices:t=>p.get("app/emotionVoices",{params:{appId:t}}),setAppEmotionVoices:t=>p.post("app/emotionVoices",t)};export{t as A};
