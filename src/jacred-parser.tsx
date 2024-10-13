import { ActionPanel, Action, List, showToast, Toast, getPreferenceValues, Color } from "@raycast/api";
import { useEffect, useState } from "react";
import fetch from "node-fetch";
import { getAuthHeaders } from "./utils";
import { JacredParsedTorrent } from "./models";

export default function Command() {
  const [query, setQuery] = useState<string>("");
  const [items, setItems] = useState<JacredParsedTorrent[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { torrserverUrl } = getPreferenceValues<Preferences>();

  useEffect(() => {
    if (query.length >= 3) {
      const timer = setTimeout(() => {
        getList(query);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [query]);

  const getList = async (query: string) => {
    setIsRefreshing(true);
    try {
      const response = await fetch(
        `https://jacred.xyz/api/v1.0/torrents?search=${encodeURIComponent(query)}&apikey=null`,
        {
          method: "GET",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch torrents");
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        const sortedItems = data.sort((a: JacredParsedTorrent, b: JacredParsedTorrent) => b.sid - a.sid);
        setItems(sortedItems);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      showToast(Toast.Style.Failure, "Error", "Failed to fetch torrents");
    } finally {
      setIsRefreshing(false);
    }
  };

  const addTorrentToServer = async (title: string, link: string) => {
    try {
      const response = await fetch(`${torrserverUrl}/torrents`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "add",
          category: "",
          link,
          poster: "",
          save_to_db: true,
          title,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add torrent: ${errorText}`);
      }

      showToast(Toast.Style.Success, "Torrent added to server");
    } catch (error) {
      showToast(Toast.Style.Failure, "Error", "Failed to add torrent");
    }
  };

  const formatTitle = (title: string, lineLength: number = 12): string[] => {
    const words = title.split(" ");
    const formattedTitle: string[] = [];
    let currentLine = "";

    words.forEach((word, index) => {
      currentLine += word + " ";

      if ((index + 1) % lineLength === 0 || index === words.length - 1) {
        formattedTitle.push(currentLine.trim());
        currentLine = "";
      }
    });

    return formattedTitle;
  };

  return (
    <List
      isShowingDetail
      searchBarPlaceholder="Search torrents (min 3 characters)"
      onSearchTextChange={setQuery}
      isLoading={isRefreshing}
    >
      {items.length === 0 ? (
        <List.EmptyView title="No torrents found" />
      ) : (
        items.map((item, index) => (
          <List.Item
            title={item.title} // Keeps the original title for the List view
            key={index}
            detail={
              <List.Item.Detail
                metadata={
                  <List.Item.Detail.Metadata>
                    <List.Item.Detail.Metadata.Label title="Title" />
                    {formatTitle(item.title).map((titleRow, index) => (
                      <List.Item.Detail.Metadata.Label key={index} title="" text={titleRow} />
                    ))}

                    <List.Item.Detail.Metadata.Separator />

                    <List.Item.Detail.Metadata.TagList title="Stats">
                      <List.Item.Detail.Metadata.TagList.Item text={`Seeds: ${item.sid}`} color={Color.Green} />
                      <List.Item.Detail.Metadata.TagList.Item text={`Peers: ${item.pir}`} color={Color.Red} />
                    </List.Item.Detail.Metadata.TagList>

                    <List.Item.Detail.Metadata.Separator />

                    <List.Item.Detail.Metadata.Label title="Size" text={item.sizeName} />
                    <List.Item.Detail.Metadata.Separator />

                    <List.Item.Detail.Metadata.Label title="Magnet Link" text={item.magnet} />
                  </List.Item.Detail.Metadata>
                }
              />
            }
            actions={
              <ActionPanel>
                <Action.CopyToClipboard title="Copy Magnet Link" content={item.magnet} />
                <Action title="Add Torrent to Server" onAction={() => addTorrentToServer(item.title, item.magnet)} />
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
