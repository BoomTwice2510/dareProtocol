export interface FlashTaskTemplate { id:string; title:string; description:string; deadline:number; proofType:string; failureRate:string; oracleLink?:string; }
export interface FlashTaskCategory { id:string; name:string; emoji:string; description:string; failureRating:number; templates:FlashTaskTemplate[]; }
export function secondsToDuration(deadline:number){ return deadline%86400===0?{type:"days" as const,value:Math.max(1,deadline/86400)}:{type:"hours" as const,value:Math.max(1,Math.round(deadline/3600))}; }
const t=(id:string,title:string,description:string,deadline:number,proofType:string):FlashTaskTemplate=>({id,title,description,deadline,proofType,failureRate:""});
export const FLASH_TASK_CATEGORIES:FlashTaskCategory[]=[
 {id:"fitness",name:"Fitness & movement",emoji:"🏃",description:"Tasks with evidence from activity apps or a simple recording.",failureRating:2,templates:[
  t("run-5k","Complete a 5 km run","Run at least 5 km in one continuous session before the deadline.",86400,"Strava / Garmin / Apple Health activity screenshot or public activity link"),
  t("steps-8k","Reach 8,000 steps in a day","Record at least 8,000 steps during the challenge window.",86400,"Health app daily summary screenshot"),
 ]},
 {id:"build",name:"Build & ship",emoji:"🛠️",description:"Public work with a URL, commit or deployment transaction anyone can inspect.",failureRating:2,templates:[
  t("merge-pr","Merge one meaningful GitHub PR","Open and merge one substantive pull request into the chosen repository.",259200,"Public GitHub pull request URL + merged timestamp"),
  t("deploy-testnet","Deploy a contract on Base Sepolia","Deploy a contract to Base Sepolia and leave the deployment publicly inspectable.",86400,"Base Sepolia explorer transaction URL"),
 ]},
 {id:"creator",name:"Creator & social",emoji:"✍️",description:"Public posts and links that another person can verify directly.",failureRating:2,templates:[
  t("build-update","Publish one build update","Share a concrete progress update about something you are building.",86400,"Public post URL"),
 ]},
 {id:"learning",name:"Learning & skill",emoji:"📚",description:"A finished artifact is the proof, not a claim that you studied.",failureRating:2,templates:[
  t("summary-500","Write a 500-word technical summary","Read one chosen source and publish a 500+ word summary with the source linked.",259200,"Public document or published article URL"),
  t("ten-exercises","Complete 10 coding exercises","Finish ten exercises in one chosen coding practice set.",604800,"Public progress/completion page or repository evidence"),
 ]},
 {id:"onchain",name:"Onchain actions",emoji:"⛓️",description:"Proof is a transaction hash that anyone can inspect on Base.",failureRating:1,templates:[
  t("base-3tx","Make 3 Base transactions","Complete three valid transactions on Base during the challenge window.",86400,"Three Base explorer transaction URLs"),
  t("mint-free","Mint one free NFT on Base","Mint a free NFT from a chosen collection without counting the gas payment as the result.",259200,"Base explorer transaction URL + collection URL"),
 ]},
];
