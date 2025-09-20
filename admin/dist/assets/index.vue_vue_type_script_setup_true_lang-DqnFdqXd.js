
/**
 * 由 Fantastic-admin 提供技术支持
 * Powered by Fantastic-admin
 * https://fantastic-admin.github.io
 */

import{d as a,ag as t,r as e,c as o,e as s,ah as r,ac as i,i as n,Z as l,g as c,ae as d,f as p,_ as b,h as g,t as u}from"./index-OVrsGEBz.js";const f={key:0,class:"title-container border-b-1 border-b-[var(--g-bg)] border-b-solid px-5 py-4 transition-border-color-300"},h={class:"main-container p-5"},m=a({name:"PageMain",__name:"index",props:{title:{default:""},collaspe:{type:Boolean,default:!1},height:{default:""}},setup(a){const m=a,v=!!t().title,x=e(m.collaspe);function y(){x.value=!1}return(a,t)=>{const e=b;return s(),o("div",{class:i(["page-main relative m-4 flex flex-col bg-[var(--g-container-bg)] transition-background-color-300",{"of-hidden":n(x)}]),style:r({height:n(x)?a.height:""})},[v||a.title?(s(),o("div",f,[d(a.$slots,"title",{},(()=>[g(u(a.title),1)]))])):l("",!0),c("div",h,[d(a.$slots,"default")]),n(x)?(s(),o("div",{key:1,class:"collaspe absolute bottom-0 w-full cursor-pointer from-transparent to-[var(--g-container-bg)] bg-gradient-to-b pb-2 pt-10 text-center",onClick:y},[p(e,{name:"i-ep:arrow-down",class:"text-xl op-30 transition-opacity hover-op-100"})])):l("",!0)],6)}}});export{m as _};
