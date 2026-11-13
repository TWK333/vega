!function(t){try{var e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{},n="Error\n    at "+t+":1:1";e._sentryDebugIds=e._sentryDebugIds||{},e._sentryDebugIds[n]="2976942b-c1a3-468e-a9f8-edda692180ab",e._sentryDebugIdIdentifier="sentry-dbid-2976942b-c1a3-468e-a9f8-edda692180ab"}catch(e){}}(import.meta.url);
import{on as e}from"./index.eager-common-DcDxc78C.js";import{ik as t}from"./index.eager-app-BwKPFs1J.js";function n(t){let{id:n,label:r}=t;return e._({id:`93GOzw`,values:{label:r,id:n}})}function r(e){return{type:`paragraph`,content:[{type:`text`,text:e}]}}function i(e){let t={type:`doc`,content:e.split(`

`).map(e=>e.length===0?{type:`paragraph`}:r(e))};return{prompt:e,richText:JSON.stringify(t)}}function a(e){let{lead:i,items:a,nudge:o}=e,s={type:`bulletList`,content:a.map(e=>({type:`listItem`,content:[{type:`paragraph`,content:[{type:t,attrs:{id:e.id,label:e.label}}]}]}))},c={type:`doc`,content:[r(i),s,r(o)]};return{prompt:[i,a.map(e=>`- ${n(e)}`).join(`
`),o].join(`

`),richText:JSON.stringify(c)}}export{n,a as r,i as t};
//# debugId=2976942b-c1a3-468e-a9f8-edda692180ab
