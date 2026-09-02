import {notFound} from "next/navigation";import{SitePage,pages,type PageKey}from"../site";
export function generateStaticParams(){return pages.filter(x=>x!=="home").map(slug=>({slug}))}
export default async function Page({params}:{params:Promise<{slug:string}>}){const{slug}=await params;if(!pages.includes(slug as PageKey))notFound();return <SitePage page={slug as PageKey}/>}
