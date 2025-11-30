
/**
 * 由 Fantastic-admin 提供技术支持
 * Powered by Fantastic-admin
 * https://fantastic-admin.github.io
 */

import{d as a,au as t,r as e,c as o,e as s,av as r,a2 as i,i as n,a1 as l,g as c,as as d,f as p,_ as b,h as g,t as u}from"./index-DGiiYem6.js";const f={key:0,class:"title-container border-b-1 border-b-[var(--g-bg)] border-b-solid px-5 py-4 transition-border-color-300"},v={class:"main-container p-5"},m=a({name:"PageMain",__name:"index",props:{title:{default:""},collaspe:{type:Boolean,default:!1},height:{default:""}},setup(a){const m=a,h=!!t().title,x=e(m.collaspe);function y(){x.value=!1}return(t,e)=>{const m=b;return s(),o("div",{class:i(["page-main relative m-4 flex flex-col bg-[var(--g-container-bg)] transition-background-color-300",{"of-hidden":n(x)}]),style:r({height:n(x)?a.height:""})},[h||a.title?(s(),o("div",f,[d(t.$slots,"title",{},()=>[g(u(a.title),1)])])):l("",!0),c("div",v,[d(t.$slots,"default")]),n(x)?(s(),o("div",{key:1,class:"collaspe absolute bottom-0 w-full cursor-pointer from-transparent to-[var(--g-container-bg)] bg-gradient-to-b pb-2 pt-10 text-center",onClick:y},[p(m,{name:"i-ep:arrow-down",class:"text-xl op-30 transition-opacity hover-op-100"})])):l("",!0)],6)}}});export{m as _};
