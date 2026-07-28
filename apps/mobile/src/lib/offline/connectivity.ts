import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

export function isNetworkOnline(state: NetInfoState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

export async function getNetworkOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return isNetworkOnline(state);
}

export function subscribeToNetworkStatus(onChange: (online: boolean) => void): () => void {
  return NetInfo.addEventListener((state) => {
    onChange(isNetworkOnline(state));
  });
}
