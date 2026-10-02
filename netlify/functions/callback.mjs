// Acknowledge required provider callbacks; discard all data. UI polls authenticated status.
export async function handler(event) {
  return {statusCode:event.httpMethod==='POST'?200:405,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({received:event.httpMethod==='POST'})};
}
