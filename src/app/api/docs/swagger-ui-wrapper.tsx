"use client";

// isolated entry for next/dynamic: keeps the ~500KB swagger-ui-react component
// AND its stylesheet out of the shared bundle by co-locating both static imports
// inside a module that only loads when /api/docs is requested.

import SwaggerUIReact from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

export default SwaggerUIReact;
