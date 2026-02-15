/**
 * Type declarations for Telegram Web App SDK (telegram-web-app.js).
 * @see https://core.telegram.org/bots/webapps
 */
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        BackButton: {
          hide: () => void;
          offClick: (cb: () => void) => void;
          onClick: (cb: () => void) => void;
          show: () => void;
          visible: boolean;
        };
        close: () => void;
        expand: () => void;
        initData: string;
        initDataUnsafe: {
          user?: {
            first_name?: string;
            id: number;
            language_code?: string;
            last_name?: string;
            username?: string;
          };
        };
        MainButton: {
          color: string;
          disable: () => void;
          enable: () => void;
          hide: () => void;
          hideProgress: () => void;
          offClick: (cb: () => void) => void;
          onClick: (cb: () => void) => void;
          setText: (text: string) => void;
          show: () => void;
          showProgress: (leaveActive?: boolean) => void;
          text: string;
          textColor: string;
          visible: boolean;
        };
        openInvoice: (url: string, callback?: (status: string) => void) => void;
        openLink: (url: string) => void;
        ready: () => void;
        setBackgroundColor: (color: string) => void;
        setHeaderColor: (color: string) => void;
        showPopup: (
          params: {
            buttons?: { id?: string; text: string; type?: string }[];
            message: string;
            title?: string;
          },
          callback?: (buttonId: string) => void,
        ) => void;
        themeParams: {
          bg_color?: string;
          button_color?: string;
          button_text_color?: string;
          hint_color?: string;
          link_color?: string;
          secondary_bg_color?: string;
          text_color?: string;
        };
      };
    };
  }
}

export {};
