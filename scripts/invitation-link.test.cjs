const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
test('La clienta no regenera enlaces y editar conserva el enlace y QR',async()=>{
 const guest={id:'g',token:'enlace-compartido',codigo_entrada:'qr-original',nombre:'Ana',pases_asignados:4,evento:{usuario_id:'client',usuario:{organizacion_id:'org'},fecha_limite_rsvp:'2099-01-01'}};
 let writes=0;
 const prisma={invitado:{findUnique:async()=>guest,updateMany:async({data})=>{writes++;assert.equal(data.token,undefined);assert.equal(data.codigo_entrada,undefined);Object.assign(guest,data);return {count:1};}}};
 const mocks={'@/lib/prisma':prisma,'@/lib/auth':{getCurrentUser:async()=>({id:'client',rol:'clienta'})},'next/server':{NextResponse:{json:(data,init)=>Response.json(data,init)}},'@/lib/utils':{isEventFinished:()=>false},'@/lib/names':{isValidName:()=>true},'@/lib/attendance-lock':{hasAttendance:()=>false},'@/lib/pass-balance':{},'@/lib/tokens':{generateInvitationToken:()=>{throw Error('No debe regenerar');}}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/invitados/[id]/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{exports,require:n=>mocks[n],Date,console});
 const put=body=>exports.PUT(new Request('http://localhost/api/invitados/g',{method:'PUT',body:JSON.stringify(body)}),{params:Promise.resolve({id:'g'})});
 assert.equal((await put({action:'regenerar_link'})).status,403);assert.equal(writes,0);
 assert.equal((await put({nombre:'Ana María',grupo:'Familia'})).status,200);assert.equal(guest.token,'enlace-compartido');assert.equal(guest.codigo_entrada,'qr-original');assert.equal(guest.nombre,'Ana María');
});
