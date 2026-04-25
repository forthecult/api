import type { MediaUpload } from "~/db/schema/uploads/types";
import type { User } from "~/db/schema/users/types";

export type UserWithUploads = User & {
  uploads: MediaUpload[];
};
