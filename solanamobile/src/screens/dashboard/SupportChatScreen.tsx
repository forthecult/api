import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getConversations, createConversation } from '../../api/support';
import type { Conversation } from '../../api/support';

type RootStackParamList = { SupportChat: { conversationId?: string } };
type Props = NativeStackScreenProps<RootStackParamList, 'SupportChat'>;

export function SupportChatScreen({ route, navigation }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConversations()
      .then((res) => setConversations(res.conversations ?? []))
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  }, []);

  const startNew = async () => {
    try {
      const conv = await createConversation();
      setConversations((prev) => [conv, ...prev]);
      // Could navigate to a chat thread screen with conv.id
    } catch {
      // ignore
    }
  };

  if (loading) return <View style={styles.centered}><Text>Loading...</Text></View>;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.newButton} onPress={startNew}>
        <Text style={styles.newButtonText}>New conversation</Text>
      </TouchableOpacity>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowId}>{item.id.slice(0, 8)}...</Text>
            <Text style={styles.rowStatus}>{item.status ?? 'open'}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No conversations yet</Text>}
      />
      <Text style={styles.placeholder}>Thread view and send message to be wired (no design yet).</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, padding: 16 },
  newButton: { backgroundColor: '#000', padding: 12, borderRadius: 8, marginBottom: 16 },
  newButtonText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  row: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#eee', flexDirection: 'row', justifyContent: 'space-between' },
  rowId: { fontFamily: 'monospace' },
  rowStatus: { color: '#666' },
  empty: { padding: 24, color: '#666' },
  placeholder: { marginTop: 16, color: '#999' },
});
