import { Linking } from "react-native";

type DownloadUrlResult = {
  url: string;
  expiresInSeconds: number;
};

export async function openPresignedDownload(
  getUrl: () => Promise<DownloadUrlResult>,
): Promise<void> {
  const { url } = await getUrl();
  await Linking.openURL(url);
}
