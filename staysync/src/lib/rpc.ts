export async function rpcCall(actionName: string, ...args: any[]) {
  try {
    const res = await fetch('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: actionName, args })
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || 'RPC Call Failed' };
  }
}
