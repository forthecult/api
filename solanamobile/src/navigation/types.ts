export type RootStackParamList = {
  Connect: undefined;
  MainTabs: undefined;
  ProductDetail: { slug: string };
  Checkout: { invoiceId: string };
  EsimDetail: { packageId: string };
  SupportChat: { conversationId?: string };
};

export type MainTabParamList = {
  Shop: undefined;
  Governance: undefined;
  eSIM: undefined;
  Dashboard: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
