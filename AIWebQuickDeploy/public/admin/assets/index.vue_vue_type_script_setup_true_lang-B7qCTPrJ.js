
/**
 * 由 Fantastic-admin 提供技术支持
 * Powered by Fantastic-admin
 * https://fantastic-admin.github.io
 */

import{d as a,as as t,r as e,c as o,e as s,at as r,ao as i,i as n,a1 as l,g as c,aq as d,f as p,_ as b,h as g,t as u}from"./index-B69F82kY.js";const f={key:0,class:"title-container border-b-1 border-b-[var(--g-bg)] border-b-solid px-5 py-4 transition-border-color-300"},m={class:"main-container p-5"},v=a({name:"PageMain",__name:"index",props:{title:{default:""},collaspe:{type:Boolean,default:!1},height:{default:""}},setup(a){const v=a,h=!!t().title,x=e(v.collaspe);function y(){x.value=!1}return(t,e)=>{const v=b;return s(),o("div",{class:i(["page-main relative m-4 flex flex-col bg-[var(--g-container-bg)] transition-background-color-300",{"of-hidden":n(x)}]),style:r({height:n(x)?a.height:""})},[h||a.title?(s(),o("div",f,[d(t.$slots,"title",{},()=>[g(u(a.title),1)])])):l("",!0),c("div",m,[d(t.$slots,"default")]),n(x)?(s(),o("div",{key:1,class:"collaspe absolute bottom-0 w-full cursor-pointer from-transparent to-[var(--g-container-bg)] bg-gradient-to-b pb-2 pt-10 text-center",onClick:y},[p(v,{name:"i-ep:arrow-down",class:"text-xl op-30 transition-opacity hover-op-100"})])):l("",!0)],6)}}});export{v as _};
