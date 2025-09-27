(function (window) {
  "use strict";

  function definePOSComponents() {
    const M = window.Mishkah || {};
    const C = M.Comp;
    const U = M.utils || {};
    if (!C || !window.Mishkah || !window.Mishkah.Atoms) return false;
    if (M.__POSComponentsReady) return true;

    const cx = (...classes) => classes.filter(Boolean).join(" ");
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const formatDateTime = (value, locale = "ar") => {
      if (!value) return "—";
      try {
        const fmtLocale = locale === "ar" ? "ar-EG" : "en-GB";
        return new Date(value).toLocaleString(fmtLocale, { dateStyle: "medium", timeStyle: "short" });
      } catch (_) {
        return value;
      }
    };

  C.define("POSRoot", (A, s, app) => {
    const stage = s.ui.stage;
    if (stage === "loading") {
      return app.call("POSLoadingScreen", { uniqueKey: "loading-screen" });
    }
    if (stage === "login") {
      return app.call("POSLoginScreen", { uniqueKey: "login-screen" });
    }
    if (stage === "shift-setup") {
      return app.call("POSShiftSetup", { uniqueKey: "shift-setup" });
    }
    return app.call("POSViewport", { uniqueKey: "pos-root" });
  });

  C.define("POSLoadingScreen", (A, s, app) =>
    A.Div({
      style: {
        position: "fixed",
        inset: 0,
        background: "var(--bg-page)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "16px"
      }
    }, {
      default: [
        A.Div({
          style: {
            width: "52px",
            height: "52px",
            borderRadius: "50%",
            border: "4px solid rgba(99,102,241,0.12)",
            borderTopColor: "var(--primary)",
            transform: "rotate(45deg)"
          }
        }),
        A.Span({ style: { fontSize: "16px", color: "var(--text-subtle)" } }, {
          default: [app.i18n.t("ui.loading")]
        })
      ]
    })
  );

  C.define("POSLoginScreen", (A, s, app) => {
    const login = s.ui.login;
    const pinLength = clamp((login.pin || "").length, 0, 6);

    return A.Div({
      style: {
        position: "fixed",
        inset: 0,
        background: "var(--bg-page)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "32px",
        padding: "24px"
      }
    }, {
      default: [
        A.Div({ style: { textAlign: "center", maxWidth: "360px" } }, {
          default: [
            A.H1({ style: { fontSize: "2rem", marginBottom: "8px", fontWeight: 700 } }, {
              default: [app.i18n.t("ui.welcome")]
            }),
            A.P({ style: { fontSize: "1rem", color: "var(--text-subtle)" } }, {
              default: [app.i18n.t("ui.enter_pin")]
            })
          ]
        }),
        A.Div({
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            direction: "ltr"
          }
        }, {
          default: Array.from({ length: 4 }).map((_, idx) =>
            A.Div({
              style: {
                width: "56px",
                height: "68px",
                borderRadius: "20px",
                border: "1px solid var(--border-default)",
                background: "var(--bg-surface)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "32px",
                fontWeight: 600
              }
            }, { default: [idx < pinLength ? "●" : ""] })
          )
        }),
        login.error ? A.Div({
          style: {
            minWidth: "240px",
            borderRadius: "16px",
            padding: "12px 16px",
            background: "rgba(239,68,68,0.12)",
            color: "var(--danger)",
            textAlign: "center",
            fontWeight: 600
          }
        }, { default: [login.error] }) : null,
        app.call("POSPinPad", {
          keys: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "⌫"],
          confirmLabel: app.i18n.t("ui.login"),
          confirmCommand: "auth.pinSubmit",
          keyCommand: "auth.pinKey",
          clearCommand: "auth.pinClear"
        })
      ]
    });
  });

  C.define("POSPinPad", (A, s, app, p = {}) => {
    const keys = p.keys || ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "⌫"];
    const layout = [];
    keys.forEach((key) => {
      layout.push(app.call("Button", {
        text: key,
        size: "lg",
        variant: "ghost",
        style: {
          height: "64px",
          fontSize: "24px",
          borderRadius: "18px"
        },
        "data-onclick": p.keyCommand,
        "data-key": key
      }));
    });

    const buttonsRow = [];
    if (p.clearCommand) {
      buttonsRow.push(app.call("Button", {
        text: app.i18n.t("ui.clear"),
        variant: "outline",
        style: { height: "56px", borderRadius: "18px" },
        "data-onclick": p.clearCommand
      }));
    }
    if (p.confirmCommand) {
      buttonsRow.push(app.call("Button", {
        text: p.confirmLabel || app.i18n.t("ui.confirm"),
        intent: "success",
        style: { height: "56px", borderRadius: "18px", fontSize: "18px", fontWeight: 600 },
        "data-onclick": p.confirmCommand
      }));
    }

    return A.Div({
      style: {
        width: "min(360px, 90vw)",
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }
    }, {
      default: [
        A.Div({
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "12px"
          }
        }, { default: layout }),
        buttonsRow.length ? A.Div({
          style: {
            display: "grid",
            gridTemplateColumns: `repeat(${buttonsRow.length}, minmax(0, 1fr))`,
            gap: "12px"
          }
        }, { default: buttonsRow }) : null
      ]
    });
  });

  C.define("POSShiftSetup", (A, s, app) => {
    const cashier = s.session.cashier;
    const openingFloat = s.ui.shift.openingFloat ?? "";
    return A.Div({
      style: {
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-page)",
        padding: "24px"
      }
    }, {
      default: [
        app.call("Panel", {
          style: { width: "min(440px, 95vw)" }
        }, {
          header: [app.i18n.t("ui.open_shift")],
          body: [
            A.Div({ style: { display: "flex", flexDirection: "column", gap: "12px" } }, {
              default: [
                A.Div({ style: { display: "flex", flexDirection: "column", gap: "4px" } }, {
                  default: [
                    A.Span({ style: { color: "var(--text-subtle)", fontSize: "14px" } }, {
                      default: [app.i18n.t("ui.cashier")]
                    }),
                    A.Strong({ style: { fontSize: "18px" } }, { default: [cashier ? cashier.full_name : "—"] })
                  ]
                }),
                A.Label({ style: { display: "flex", flexDirection: "column", gap: "6px" } }, {
                  default: [
                    A.Span({ style: { fontWeight: 600 } }, { default: [app.i18n.t("ui.opening_float")] }),
                    app.call("Input", {
                      type: "number",
                      min: "0",
                      step: "0.01",
                      value: openingFloat,
                      placeholder: "0.00",
                      "data-oninput": "shift.updateOpeningFloat"
                    })
                  ]
                })
              ]
            })
          ],
          footer: [
            app.call("Button", {
              text: app.i18n.t("ui.open_shift"),
              intent: "success",
              style: { minWidth: "140px", height: "48px" },
              "data-onclick": "shift.open"
            })
          ]
        })
      ]
    });
  });

  C.define("POSViewport", (A, s, app) => {
    const dir = s.env?.dir || document?.documentElement?.dir || "ltr";
    const isRTL = dir === "rtl";
    const gridTemplateAreas = isRTL
      ? `'header header' 'menu order' 'menu footer'`
      : `'header header' 'order menu' 'footer menu'`;
    const gridTemplateColumns = isRTL
      ? "minmax(0, 1fr) clamp(320px, 34vw, 420px)"
      : "clamp(320px, 34vw, 420px) minmax(0, 1fr)";

    return A.Div({
      style: {
        height: "100vh",
        width: "100vw",
        display: "grid",
        gridTemplateAreas,
        gridTemplateRows: "64px 1fr 88px",
        gridTemplateColumns,
        direction: dir,
        background: "var(--bg-page)",
        overflow: "hidden"
      }
    }, {
      default: [
        app.call("POSTopBar", { uniqueKey: "pos-header" }),
        app.call("POSMenuPanel", { uniqueKey: "menu-panel" }),
        app.call("POSOrderPanel", { uniqueKey: "order-panel" }),
        app.call("POSFooterBar", { uniqueKey: "footer-bar" }),
        app.call("POSModalsRoot", { uniqueKey: "modals-root" }),
        app.call("POSToastsRoot", { uniqueKey: "toasts-root" })
      ]
    });
  });

  C.define("POSTopBar", (A, s, app) => {
    const shift = s.session.shift;
    const cashier = s.session.cashier;
    const locale = s.env.locale;
    const shiftLabel = shift
      ? `${app.i18n.t("ui.shift")} #${shift.id}`
      : app.i18n.t("ui.no_shift");

    return A.Header({
      style: {
        gridArea: "header",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        borderBottom: "1px solid var(--border-default)",
        background: "var(--bg-surface)",
        boxShadow: "0 1px 0 rgba(15,23,42,0.04)"
      }
    }, {
      default: [
        A.Div({ style: { display: "flex", alignItems: "center", gap: "16px" } }, {
          default: [
            A.Div({ style: { fontSize: "22px", fontWeight: 700, color: "var(--primary)" } }, { default: ["Mishkah POS"] }),
            A.Div({ style: { display: "flex", flexDirection: "column", gap: "2px" } }, {
              default: [
                A.Strong({ style: { fontSize: "16px" } }, {
                  default: [cashier ? cashier.full_name : app.i18n.t("ui.cashier")]
                }),
                A.Span({ style: { color: "var(--text-subtle)", fontSize: "12px" } }, { default: [shiftLabel] })
              ]
            })
          ]
        }),
        A.Div({ style: { display: "flex", alignItems: "center", gap: "8px" } }, {
          default: [
            app.call("Button", {
              text: app.i18n.t("ui.tables"),
              variant: "outline",
              size: "sm",
              "data-onclick": "view.showTables"
            }),
            app.call("Button", {
              text: app.i18n.t("ui.reservations"),
              variant: "outline",
              size: "sm",
              "data-onclick": "view.showReservations"
            }),
            app.call("Button", {
              text: app.i18n.t("ui.returns"),
              variant: "outline",
              size: "sm",
              "data-onclick": "returns.open"
            }),
            app.call("Button", {
              text: app.i18n.t("ui.reports"),
              variant: "outline",
              size: "sm",
              "data-onclick": "view.showReports"
            }),
            app.call("Button", {
              text: app.i18n.t("ui.view_summary"),
              variant: "outline",
              size: "sm",
              disabled: !shift,
              "data-onclick": "shift.showSummary",
              "data-intent": "view"
            }),
            app.call("Button", {
              text: app.i18n.t("ui.close_shift"),
              intent: "danger",
              size: "sm",
              disabled: !shift,
              "data-onclick": "shift.showSummary",
              "data-intent": "close"
            }),
            app.call("Button", {
              text: "🎨",
              variant: "ghost",
              size: "sm",
              title: app.i18n.t("ui.theme"),
              "data-onclick": "env.toggleTheme"
            }),
            app.call("Button", {
              text: locale === "ar" ? "EN" : "AR",
              variant: "ghost",
              size: "sm",
              title: app.i18n.t("ui.language"),
              "data-onclick": "env.toggleLocale"
            }),
            app.call("Button", {
              text: app.i18n.t("ui.logout"),
              intent: "danger",
              variant: "ghost",
              size: "sm",
              "data-onclick": "session.logout"
            })
          ]
        })
      ]
    });
  });

  const filterMenuItems = (state) => {
    const locale = state.env.locale || "ar";
    const search = (state.ui.menu.search || "").trim().toLowerCase();
    const activeCategory = state.ui.menu.category || "all";
    return state.catalog.items.filter((item) => {
      const matchCategory = activeCategory === "all" || item.category === activeCategory;
      if (!matchCategory) return false;
      if (!search) return true;
      const translation = (item.translations && (item.translations[locale] || item.translations.en)) || {};
      const name = (translation.name || "").toLowerCase();
      return name.includes(search);
    });
  };

  C.define("POSMenuPanel", (A, s, app) => {
    const categories = s.catalog.categories || [];
    const locale = s.env.locale || "ar";
    const activeCategory = s.ui.menu.category || "all";
    const filteredItems = filterMenuItems(s);

    return A.Div({
      style: {
        gridArea: "menu",
        display: "flex",
        flexDirection: "column",
        padding: "16px 20px",
        gap: "16px",
        overflow: "hidden"
      }
    }, {
      default: [
        app.call("SearchBar", {
          value: s.ui.menu.search || "",
          placeholder: app.i18n.t("ui.search_placeholder"),
          onInput: "menu.search",
          onClear: "menu.clearSearch"
        }),
        A.Div({
          class: "no-scrollbar",
          style: {
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            paddingBottom: "4px"
          }
        }, {
          default: categories.map((cat) => {
            const translation = (cat.translations && (cat.translations[locale] || cat.translations.en)) || {};
            const isActive = activeCategory === cat.id;
            return A.Button({
              type: "button",
              "data-onclick": "menu.selectCategory",
              "data-category-id": cat.id,
              style: {
                borderRadius: "999px",
                border: `1px solid ${isActive ? "var(--primary)" : "var(--border-default)"}`,
                background: isActive ? "var(--primary-soft, rgba(99,102,241,0.12))" : "var(--bg-surface)",
                color: isActive ? "var(--primary)" : "var(--text-default)",
                padding: "8px 14px",
                fontWeight: isActive ? 600 : 500,
                whiteSpace: "nowrap"
              }
            }, { default: [translation.name || cat.id] });
          })
        }),
        A.Div({
          class: "no-scrollbar",
          style: {
            flex: "1 1 auto",
            overflowY: "auto"
          }
        }, {
          default: filteredItems.length ? A.Div({
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "16px",
              paddingBottom: "16px"
            }
          }, {
            default: filteredItems.map((item) => app.call("POSMenuCard", { item }))
          }) : app.call("EmptyState", {
            title: app.i18n.t("ui.empty_menu_title"),
            text: app.i18n.t("ui.empty_menu_hint")
          })
        })
      ]
    });
  });

  C.define("POSMenuCard", (A, s, app, p) => {
    const item = p.item;
    const locale = s.env.locale || "ar";
    const translation = (item.translations && (item.translations[locale] || item.translations.en)) || {};
    const helpers = app.helpers || {};
    const formatCurrency = helpers.formatCurrency || ((v) => v.toFixed(2));
    
    return A.Div({
      "data-onclick": "order.addItem",
      "data-item-id": item.id,
      style: {
        cursor: "pointer",
        borderRadius: "20px",
        overflow: "hidden",
        border: "1px solid var(--border-default)",
        background: "var(--bg-surface)",
        display: "flex",
        flexDirection: "column",
        minHeight: "220px",
        boxShadow: "0 12px 24px -18px rgba(15,23,42,0.4)"
      }
    }, {
      default: [
        item.image ? A.Img({
          src: item.image,
          alt: translation.name || "",
          style: {
            width: "100%",
            height: "120px",
            objectFit: "cover"
          }
        }) : null,
        A.Div({
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            padding: "12px"
          }
        }, {
          default: [
            A.Strong({ style: { fontSize: "15px", minHeight: "40px", display: "block" } }, { default: [translation.name || "—"] }),
            translation.description ? A.P({ style: { color: "var(--text-subtle)", fontSize: "12px" } }, {
              default: [translation.description]
            }) : null,
            A.Div({ style: { marginTop: "auto", textAlign: "end", fontWeight: 700, color: "var(--primary)" } }, {
              default: [formatCurrency(item.price, { currency: s.settings.currency })]
            })
          ]
        })
      ]
    });
  });

  C.define("POSOrderPanel", (A, s, app) => {
    const order = s.order;
    const dir = s.env?.dir || document?.documentElement?.dir || "ltr";
    const isRTL = dir === "rtl";
    const borderKey = isRTL ? "borderInlineStart" : "borderInlineEnd";

    const baseStyle = {
      gridArea: "order",
      background: "var(--bg-surface)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    };
    baseStyle[borderKey] = "1px solid var(--border-default)";

    if (!order) {
      return A.Div({
        style: baseStyle
      }, { default: [app.call("EmptyState", { title: app.i18n.t("ui.no_active_order") })] });
    }

    const style = {
      gridArea: "order",
      display: "flex",
      flexDirection: "column",
      background: "var(--bg-surface)",
      height: "100%"
    };
    style[borderKey] = "1px solid var(--border-default)";

    return A.Div({
      style,
      class: "order-panel"
    }, {
      default: [
        app.call("POSOrderHeader", { order }),
        app.call("POSOrderLines", { order }),
        order.lines.length ? app.call("POSOrderTotals", { order }) : null
      ]
    });
  });

  C.define("POSOrderHeader", (A, s, app, p) => {
    const order = p.order;
    const locale = s.env.locale || "ar";
    const tableNames = (order.tableIds || []).map((tableId) => {
      const table = s.tables.find((t) => t.id === tableId);
      return table ? table.name : tableId;
    });

    const typeItems = [
      { id: "dine_in", label: app.i18n.t("ui.dine_in") },
      { id: "takeaway", label: app.i18n.t("ui.takeaway") },
      { id: "delivery", label: app.i18n.t("ui.delivery") }
    ];

    return A.Div({
      style: {
        padding: "16px",
        borderBottom: "1px solid var(--border-default)",
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }
    }, {
      default: [
        A.Div({ style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, {
          default: [
            A.Div({ style: { fontWeight: 700 } }, { default: [app.i18n.t("ui.current_order")] }),
            tableNames.length ? A.Div({
              style: {
                display: "inline-flex",
                gap: "8px",
                alignItems: "center"
              }
            }, {
              default: [
                A.Span({ style: { color: "var(--text-subtle)", fontSize: "12px" } }, { default: [app.i18n.t("ui.table")] }),
                A.Span({ style: { fontWeight: 600 } }, { default: [tableNames.join(", ")] })
              ]
            }) : null
          ]
        }),
        A.Div({ style: { display: "flex", gap: "8px" } }, {
          default: typeItems.map((item) => A.Button({
            type: "button",
            "data-onclick": "order.setType",
            "data-type": item.id,
            style: {
              flex: "1 1 auto",
              padding: "10px 12px",
              borderRadius: "14px",
              border: `1px solid ${order.type === item.id ? "var(--primary)" : "var(--border-default)"}`,
              background: order.type === item.id ? "var(--primary-soft, rgba(99,102,241,0.16))" : "var(--bg-page)",
              fontWeight: order.type === item.id ? 600 : 500
            }
          }, { default: [item.label] }))
        })
      ]
    });
  });

  C.define("POSOrderLines", (A, s, app, p) => {
    const order = p.order;
    if (!order.lines.length) {
      return A.Div({
        class: "no-scrollbar",
        style: {
          flex: "1 1 auto",
          overflowY: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px"
        }
      }, { default: [app.call("EmptyState", { title: app.i18n.t("ui.empty_order"), text: app.i18n.t("ui.empty_order_hint") })] });
    }

    return A.Div({
      class: "no-scrollbar",
      style: {
        flex: "1 1 auto",
        overflowY: "auto",
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }
    }, {
      default: order.lines.map((line) => app.call("POSOrderLine", { line }))
    });
  });

  C.define("POSOrderLine", (A, s, app, p) => {
    const line = p.line;
    const helpers = app.helpers || {};
    const formatCurrency = helpers.formatCurrency || ((v) => v.toFixed(2));
    const discountLabel = line.discount && line.discount.type
      ? (line.discount.type === "percent"
        ? `${line.discount.value}%`
        : formatCurrency(line.discount.value))
      : null;

    return A.Div({
      style: {
        borderRadius: "16px",
        border: "1px solid var(--border-default)",
        padding: "12px",
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: "12px",
        background: "var(--bg-page)"
      }
    }, {
      default: [
        A.Div({
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }
        }, {
          default: [
            A.Div({ style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" } }, {
              default: [
                A.Strong({}, { default: [line.name] }),
                A.Span({ style: { fontWeight: 700, color: "var(--primary)" } }, { default: [formatCurrency(line.total)] })
              ]
            }),
            line.notes ? A.Div({ style: { fontSize: "12px", color: "var(--text-subtle)" } }, { default: [line.notes] }) : null,
            line.modifiers && line.modifiers.length ? A.Div({ style: { fontSize: "12px", color: "var(--text-subtle)" } }, {
              default: [line.modifiers.join(", ")]
            }) : null,
            discountLabel ? A.Div({ style: { fontSize: "12px", color: "var(--warning, #f59e0b)", fontWeight: 600 } }, {
              default: [`${app.i18n.t("ui.discount")}: ${discountLabel}`]
            }) : null
          ]
        }),
        A.Div({ style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" } }, {
          default: [
            A.Div({ style: { display: "inline-flex", alignItems: "center", gap: "6px" } }, {
              default: [
                app.call("Button", {
                  text: "−",
                  variant: "ghost",
                  size: "sm",
                  style: { minWidth: "36px", height: "36px", borderRadius: "12px" },
                  "data-onclick": "order.decrementLine",
                  "data-line-id": line.id
                }),
                A.Button({
                  type: "button",
                  "data-onclick": "order.openQtyNumpad",
                  "data-line-id": line.id,
                  style: {
                    minWidth: "48px",
                    height: "36px",
                    borderRadius: "12px",
                    border: "1px solid var(--border-default)",
                    background: "var(--bg-surface)",
                    fontWeight: 700
                  }
                }, { default: [line.qty] }),
                app.call("Button", {
                  text: "+",
                  variant: "ghost",
                  size: "sm",
                  style: { minWidth: "36px", height: "36px", borderRadius: "12px" },
                  "data-onclick": "order.incrementLine",
                  "data-line-id": line.id
                })
              ]
            }),
            app.call("Button", {
              text: "⋯",
              variant: "ghost",
              size: "xs",
              style: { borderRadius: "10px", width: "32px", height: "32px" },
              "data-onclick": "order.openLineActions",
              "data-line-id": line.id
            })
          ]
        })
      ]
    });
  });

  C.define("POSOrderTotals", (A, s, app, p) => {
    const order = p.order;
    const totals = order.totals;
    const helpers = app.helpers || {};
    const f = helpers.formatCurrency || ((v) => v.toFixed(2));
    return A.Div({
      style: {
        borderTop: "1px solid var(--border-default)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      }
    }, {
      default: [
        A.Div({ style: { display: "flex", justifyContent: "space-between", fontSize: "14px", color: "var(--text-subtle)" } }, {
          default: [A.Span({}, { default: [app.i18n.t("ui.subtotal")] }), A.Span({}, { default: [f(totals.subtotal)] })]
        }),
        A.Div({ style: { display: "flex", justifyContent: "space-between", fontSize: "14px", color: "var(--text-subtle)" } }, {
          default: [A.Span({}, { default: [app.i18n.t("ui.service")] }), A.Span({}, { default: [f(totals.service)] })]
        }),
        A.Div({ style: { display: "flex", justifyContent: "space-between", fontSize: "14px", color: "var(--text-subtle)" } }, {
          default: [A.Span({}, { default: [app.i18n.t("ui.vat")] }), A.Span({}, { default: [f(totals.vat)] })]
        }),
        A.Div({
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontWeight: 700,
            fontSize: "20px",
            marginTop: "8px"
          }
        }, {
          default: [A.Span({}, { default: [app.i18n.t("ui.total")] }), A.Span({}, { default: [f(totals.total)] })]
        })
      ]
    });
  });

  C.define("POSFooterBar", (A, s, app) => {
    const order = s.order;
    const helpers = app.helpers || {};
    const f = helpers.formatCurrency || ((v) => v.toFixed(2));
    const splits = s.payments.splits || [];
    const paid = splits.reduce((sum, split) => sum + (split.amount || 0), 0);
    const total = order ? order.totals.total : 0;
    const remaining = Math.max(0, total - paid);

    return A.Div({
      style: {
        gridArea: "footer",
        background: "var(--bg-surface)",
        borderTop: "1px solid var(--border-default)",
        display: "grid",
        gridTemplateColumns: "1fr clamp(240px, 30vw, 360px)",
        alignItems: "center",
        padding: "0 20px"
      }
    }, {
      default: [
        A.Div({ style: { display: "flex", alignItems: "center", gap: "18px" } }, {
          default: [
            A.Div({ style: { display: "flex", flexDirection: "column", gap: "2px" } }, {
              default: [
                A.Span({ style: { color: "var(--text-subtle)", fontSize: "12px" } }, { default: [app.i18n.t("ui.total")] }),
                A.Strong({ style: { fontSize: "20px" } }, { default: [f(total)] })
              ]
            }),
            A.Div({ style: { display: "flex", flexDirection: "column", gap: "2px" } }, {
              default: [
                A.Span({ style: { color: "var(--text-subtle)", fontSize: "12px" } }, { default: [app.i18n.t("ui.remaining")] }),
                A.Strong({ style: { fontSize: "20px", color: remaining === 0 ? "var(--success)" : "var(--danger)" } }, {
                  default: [f(remaining)]
                })
              ]
            })
          ]
        }),
        A.Div({ style: { display: "flex", justifyContent: "flex-end", gap: "12px" } }, {
          default: [
            app.call("Button", {
              text: app.i18n.t("ui.clear_order"),
              variant: "ghost",
              size: "sm",
              "data-onclick": "order.clear"
            }),
            app.call("Button", {
              text: app.i18n.t("ui.park_order"),
              variant: "outline",
              size: "sm",
              "data-onclick": "order.park"
            }),
            app.call("Button", {
              text: app.i18n.t("ui.settle_pay"),
              intent: "success",
              size: "lg",
              style: { minWidth: "160px", height: "52px", fontSize: "18px" },
              "data-onclick": "payments.open"
            })
          ]
        })
      ]
    });
  });

  C.define("POSTablesModal", (A, s, app, p = {}) => {
    if (!p.open) return null;
    const tables = s.tables || [];
    const attached = new Set((s.order?.tableIds || []).map((id) => String(id)));
    const statusPalette = {
      available: { color: "var(--success)", bg: "rgba(16,185,129,0.14)" },
      occupied: { color: "var(--danger)", bg: "rgba(239,68,68,0.14)" },
      reserved: { color: "var(--primary)", bg: "rgba(99,102,241,0.14)" },
      offline: { color: "var(--text-subtle)", bg: "rgba(148,163,184,0.18)" }
    };

    const legend = [
      { key: "available", label: app.i18n.t("ui.table_status_available") },
      { key: "occupied", label: app.i18n.t("ui.table_status_occupied") },
      { key: "reserved", label: app.i18n.t("ui.table_status_reserved") },
      { key: "offline", label: app.i18n.t("ui.table_status_offline") }
    ];

    const cards = tables.map((table) => {
      const status = table.status || "available";
      const palette = statusPalette[status] || statusPalette.available;
      const isSelected = attached.has(String(table.id));
      const disabled = status === "offline";
      const props = {
        style: {
          borderRadius: "18px",
          border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border-default)",
          background: disabled ? "rgba(148,163,184,0.12)" : "var(--bg-surface)",
          padding: "16px",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          transition: "all 140ms ease",
          position: "relative"
        }
      };
      if (!disabled) {
        props["data-onclick"] = "tables.attach";
        props["data-table-id"] = table.id;
      }
      return A.Div(props, {
        default: [
          A.Div({ style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, {
            default: [
              A.Strong({ style: { fontSize: "18px" } }, { default: [table.name || table.id] }),
              A.Span({
                style: {
                  fontSize: "12px",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: palette.bg,
                  color: palette.color,
                  fontWeight: 600
                }
              }, { default: [app.i18n.t(`ui.table_status_${status}`)] })
            ]
          }),
          A.Div({ style: { display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text-subtle)", fontSize: "13px" } }, {
            default: [
              A.Span({}, { default: [`${app.i18n.t("ui.seats")}: ${table.seats || "—"}`] }),
              isSelected ? A.Span({ style: { color: "var(--primary)", fontWeight: 600 } }, { default: [app.i18n.t("ui.available")] }) : null
            ]
          })
        ]
      });
    });

    return app.call("Modal", {
      open: p.open,
      size: "lg",
      onClose: () => app.dispatch("view.closeOverlay")
    }, {
      header: [
        A.Div({ style: { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" } }, {
          default: [
            A.Div({ style: { display: "flex", flexDirection: "column" } }, {
              default: [
                A.Strong({ style: { fontSize: "18px" } }, { default: [app.i18n.t("ui.select_tables")] }),
                A.Span({ style: { fontSize: "12px", color: "var(--text-subtle)" } }, {
                  default: [attached.size ? `${app.i18n.t("ui.table")}: ${Array.from(attached).join(", ")}` : app.i18n.t("ui.available_tables")]
                })
              ]
            }),
            app.call("Button", {
              text: "×",
              variant: "ghost",
              size: "sm",
              "data-onclick": "view.closeOverlay"
            })
          ]
        })
      ],
      body: [
        A.Div({ style: { display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "12px" } }, {
          default: legend.map((item) => {
            const palette = statusPalette[item.key] || statusPalette.available;
            return A.Span({
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                padding: "6px 10px",
                borderRadius: "999px",
                background: palette.bg,
                color: palette.color
              }
            }, {
              default: [
                A.Span({ style: { width: "8px", height: "8px", borderRadius: "50%", background: palette.color } }),
                item.label
              ]
            });
          })
        }),
        A.Div({
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: "16px",
            maxHeight: "60vh",
            overflowY: "auto",
            paddingRight: "4px"
          }
        }, { default: cards })
      ],
      footer: [
        app.call("Button", {
          text: app.i18n.t("ui.cancel"),
          variant: "ghost",
          "data-onclick": "view.closeOverlay"
        })
      ]
    });
  });

  C.define("POSReservationsModal", (A, s, app, p = {}) => {
    if (!p.open) return null;
    const stage = s.ui.reservations?.stage || "list";
    const form = s.ui.reservations?.form || {};
    const reservations = s.reservations || [];
    const tables = s.tables || [];
    const locale = s.env?.locale || "ar";

    const tableCards = (selectedIds = []) => {
      const selected = new Set((selectedIds || []).map((id) => String(id)));
      return tables.map((table) => {
        const isSelected = selected.has(String(table.id));
        return A.Div({
          style: {
            borderRadius: "14px",
            border: isSelected ? "2px solid var(--primary)" : "1px solid var(--border-default)",
            padding: "12px",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            background: "var(--bg-surface)"
          },
          "data-onclick": "reservations.toggleTable",
          "data-table-id": table.id
        }, {
          default: [
            A.Strong({ style: { fontSize: "14px" } }, { default: [table.name || table.id] }),
            A.Span({ style: { fontSize: "12px", color: "var(--text-subtle)" } }, {
              default: [`${app.i18n.t("ui.seats")}: ${table.seats || "—"}`]
            }),
            isSelected ? A.Span({ style: { fontSize: "11px", color: "var(--primary)", fontWeight: 600 } }, { default: [app.i18n.t("ui.available")] }) : null
          ]
        });
      });
    };

    const reservationCards = reservations.map((reservation) => {
      const tablesLabel = (reservation.tableIds || []).map((id) => id).join(", ");
      return A.Div({
        style: {
          border: "1px solid var(--border-default)",
          borderRadius: "16px",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          background: "var(--bg-surface)"
        }
      }, {
        default: [
          A.Div({ style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, {
            default: [
              A.Strong({ style: { fontSize: "16px" } }, { default: [reservation.customerName || app.i18n.t("ui.customer_name")] }),
              A.Span({ style: { fontSize: "12px", color: "var(--text-subtle)" } }, { default: [formatDateTime(reservation.startTime, locale)] })
            ]
          }),
          A.Div({ style: { display: "flex", gap: "12px", color: "var(--text-subtle)", fontSize: "13px" } }, {
            default: [
              A.Span({}, { default: [`${app.i18n.t("ui.party_size")}: ${reservation.partySize || "—"}`] }),
              A.Span({}, { default: [`${app.i18n.t("ui.table")}: ${tablesLabel || "—"}`] })
            ]
          }),
          reservation.notes ? A.Span({ style: { fontSize: "12px", color: "var(--text-subtle)" } }, { default: [reservation.notes] }) : null,
          A.Div({ style: { display: "flex", justifyContent: "flex-end" } }, {
            default: [
              app.call("Button", {
                text: app.i18n.t("ui.cancel_reservation"),
                intent: "danger",
                size: "xs",
                "data-onclick": "reservations.cancel",
                "data-reservation-id": reservation.id
              })
            ]
          })
        ]
      });
    });

    const listBody = reservations.length
      ? A.Div({ style: { display: "flex", flexDirection: "column", gap: "12px", maxHeight: "60vh", overflowY: "auto", paddingRight: "4px" } }, { default: reservationCards })
      : A.Div({
          style: {
            minHeight: "200px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            color: "var(--text-subtle)",
            textAlign: "center"
          }
        }, {
          default: [
            A.Strong({}, { default: [app.i18n.t("ui.no_reservations")] }),
            A.Span({ style: { fontSize: "13px" } }, { default: [app.i18n.t("ui.no_reservations_hint")] })
          ]
        });

    const formBody = A.Div({ style: { display: "flex", flexDirection: "column", gap: "12px" } }, {
      default: [
        app.call("Input", {
          value: form.customerName || "",
          placeholder: app.i18n.t("ui.customer_name"),
          "data-oninput": "reservations.updateField",
          "data-field": "customerName"
        }),
        app.call("Input", {
          type: "tel",
          value: form.phone || "",
          placeholder: app.i18n.t("ui.phone"),
          "data-oninput": "reservations.updateField",
          "data-field": "phone"
        }),
        app.call("Input", {
          type: "number",
          min: "1",
          value: form.partySize || "",
          placeholder: app.i18n.t("ui.party_size"),
          "data-oninput": "reservations.updateField",
          "data-field": "partySize"
        }),
        app.call("Input", {
          type: "datetime-local",
          value: form.startTime || "",
          "data-oninput": "reservations.updateField",
          "data-field": "startTime"
        }),
        app.call("Textarea", {
          value: form.notes || "",
          rows: 3,
          placeholder: app.i18n.t("ui.notes"),
          "data-oninput": "reservations.updateField",
          "data-field": "notes"
        }),
        A.Div({ style: { fontWeight: 600, fontSize: "14px" } }, { default: [app.i18n.t("ui.select_tables")] }),
        A.Div({
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "12px",
            maxHeight: "220px",
            overflowY: "auto",
            paddingRight: "4px"
          }
        }, { default: tableCards(form.tableIds || []) })
      ]
    });

    return app.call("Modal", {
      open: p.open,
      size: "lg",
      onClose: () => app.dispatch("view.closeOverlay")
    }, {
      header: [
        A.Div({ style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, {
          default: [
            A.Strong({ style: { fontSize: "18px" } }, { default: [app.i18n.t("ui.reservations")] }),
            stage === "list"
              ? app.call("Button", {
                  text: app.i18n.t("ui.new_reservation"),
                  intent: "primary",
                  size: "sm",
                  "data-onclick": "reservations.startForm"
                })
              : app.call("Button", {
                  text: app.i18n.t("ui.cancel"),
                  variant: "ghost",
                  size: "sm",
                  "data-onclick": "reservations.abort"
                })
          ]
        })
      ],
      body: [stage === "form" ? formBody : listBody],
      footer: [
        stage === "form"
          ? A.Div({ style: { display: "flex", justifyContent: "flex-end", gap: "12px" } }, {
              default: [
                app.call("Button", {
                  text: app.i18n.t("ui.cancel"),
                  variant: "ghost",
                  "data-onclick": "reservations.abort"
                }),
                app.call("Button", {
                  text: app.i18n.t("ui.save"),
                  intent: "success",
                  "data-onclick": "reservations.submit"
                })
              ]
            })
          : app.call("Button", {
              text: app.i18n.t("ui.done"),
              variant: "ghost",
              "data-onclick": "view.closeOverlay"
            })
      ]
    });
  });

  C.define("POSReturnsModal", (A, s, app, p = {}) => {
    if (!p.open) return null;
    const stage = s.ui.returns?.stage || "list";
    const items = s.ui.returns?.items || [];
    const helpers = app.helpers || {};
    const formatCurrency = helpers.formatCurrency || ((v) => Number(v || 0).toFixed(2));
    const orders = s.completedOrders || [];
    const locale = s.env?.locale || "ar";

    const orderCards = orders.map((order) => {
      const total = formatCurrency(order?.totals?.total || 0);
      return A.Div({
        style: {
          border: "1px solid var(--border-default)",
          borderRadius: "14px",
          padding: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          background: "var(--bg-surface)"
        },
        "data-onclick": "returns.selectOrder",
        "data-order-id": order.id
      }, {
        default: [
          A.Div({ style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, {
            default: [
              A.Strong({}, { default: [order.id] }),
              A.Span({ style: { fontSize: "12px", color: "var(--text-subtle)" } }, { default: [formatDateTime(order.closedAt || order.createdAt, locale)] })
            ]
          }),
          A.Div({ style: { display: "flex", justifyContent: "space-between", color: "var(--text-subtle)", fontSize: "13px" } }, {
            default: [
              A.Span({}, { default: [app.i18n.t(`ui.${order.type || "dine_in"}`)] }),
              A.Span({}, { default: [total] })
            ]
          })
        ]
      });
    });

    const listView = orderCards.length
      ? A.Div({ style: { display: "flex", flexDirection: "column", gap: "12px", maxHeight: "60vh", overflowY: "auto", paddingRight: "4px" } }, { default: orderCards })
      : A.Div({
          style: {
            minHeight: "200px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            color: "var(--text-subtle)",
            textAlign: "center"
          }
        }, {
          default: [
            A.Strong({}, { default: [app.i18n.t("ui.no_completed_orders")] }),
            A.Span({ style: { fontSize: "13px" } }, { default: [app.i18n.t("ui.no_completed_orders_hint")] })
          ]
        });

    const linesView = A.Div({ style: { display: "flex", flexDirection: "column", gap: "12px" } }, {
      default: items.map((item) => {
        const totalForLine = formatCurrency(item.selectedQty * item.unitPrice);
        return A.Div({
          style: {
            border: "1px solid var(--border-default)",
            borderRadius: "12px",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            background: "var(--bg-surface)"
          }
        }, {
          default: [
            A.Div({ style: { display: "flex", justifyContent: "space-between" } }, {
              default: [
                A.Strong({}, { default: [item.name || "—"] }),
                A.Span({ style: { color: "var(--text-subtle)", fontSize: "12px" } }, { default: [formatCurrency(item.unitPrice)] })
              ]
            }),
            A.Div({ style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, {
              default: [
                A.Span({ style: { fontSize: "12px", color: "var(--text-subtle)" } }, {
                  default: [`${app.i18n.t("ui.available")}: ${item.availableQty}`]
                }),
                A.Div({ style: { display: "flex", alignItems: "center", gap: "8px" } }, {
                  default: [
                    app.call("Button", {
                      text: "-",
                      variant: "ghost",
                      size: "sm",
                      "data-onclick": "returns.adjustQty",
                      "data-item-id": item.lineId,
                      "data-direction": "dec"
                    }),
                    A.Strong({}, { default: [item.selectedQty || 0] }),
                    app.call("Button", {
                      text: "+",
                      variant: "ghost",
                      size: "sm",
                      "data-onclick": "returns.adjustQty",
                      "data-item-id": item.lineId,
                      "data-direction": "inc"
                    })
                  ]
                })
              ]
            }),
            A.Div({ style: { display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-subtle)" } }, {
              default: [
                A.Span({}, { default: [app.i18n.t("ui.value")] }),
                A.Strong({}, { default: [totalForLine] })
              ]
            })
          ]
        });
      })
    });

    const selectedTotal = items.reduce((sum, item) => sum + (item.selectedQty || 0) * (item.unitPrice || 0), 0);

    const summaryView = A.Div({
      style: {
        minHeight: "180px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        gap: "12px",
        color: "var(--text-subtle)"
      }
    }, {
      default: [
        A.Strong({}, { default: [app.i18n.t("ui.return_created")] }),
        A.Span({ style: { fontSize: "13px" } }, { default: [app.i18n.t("ui.return_created_hint")] })
      ]
    });

    return app.call("Modal", {
      open: p.open,
      size: "xl",
      onClose: () => app.dispatch("returns.close")
    }, {
      header: [
        A.Div({ style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, {
          default: [
            A.Strong({ style: { fontSize: "18px" } }, { default: [app.i18n.t("ui.returns")] }),
            app.call("Button", {
              text: "×",
              variant: "ghost",
              size: "sm",
              "data-onclick": "returns.close"
            })
          ]
        })
      ],
      body: [stage === "list" ? listView : stage === "lines" ? linesView : summaryView],
      footer: [
        stage === "list"
          ? app.call("Button", {
              text: app.i18n.t("ui.cancel"),
              variant: "ghost",
              "data-onclick": "returns.close"
            })
          : stage === "lines"
            ? A.Div({ style: { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" } }, {
                default: [
                  A.Div({ style: { display: "flex", flexDirection: "column", gap: "4px", color: "var(--text-subtle)", fontSize: "12px" } }, {
                    default: [
                      A.Span({}, { default: [app.i18n.t("ui.value")] }),
                      A.Strong({}, { default: [formatCurrency(selectedTotal)] })
                    ]
                  }),
                  A.Div({ style: { display: "flex", gap: "8px" } }, {
                    default: [
                      app.call("Button", {
                        text: app.i18n.t("ui.back"),
                        variant: "ghost",
                        "data-onclick": "returns.open"
                      }),
                      app.call("Button", {
                        text: app.i18n.t("ui.create_return"),
                        intent: "success",
                        disabled: selectedTotal <= 0,
                        "data-onclick": "returns.submit"
                      })
                    ]
                  })
                ]
              })
            : app.call("Button", {
                text: app.i18n.t("ui.done"),
                intent: "primary",
                "data-onclick": "returns.close"
              })
      ]
    });
  });

  C.define("POSLineActionsSheet", (A, s, app, p = {}) => {
    if (!p.open) return null;
    const lineId = s.ui.overlays?.payload?.lineId;
    const line = (s.order?.lines || []).find((entry) => entry.id === lineId);
    if (!line) return app.call("Sheet", { open: true, onClose: () => app.dispatch("order.closeLineActions") }, { body: [A.Div({ default: [app.i18n.t("ui.no_active_order")] })] });

    return app.call("Sheet", {
      open: p.open,
      side: "end",
      size: "sm",
      onClose: () => app.dispatch("order.closeLineActions")
    }, {
      header: [
        A.Div({ style: { display: "flex", flexDirection: "column", gap: "4px" } }, {
          default: [
            A.Strong({ style: { fontSize: "16px" } }, { default: [line.name || app.i18n.t("ui.items")] }),
            A.Span({ style: { fontSize: "12px", color: "var(--text-subtle)" } }, { default: [app.i18n.t("ui.line_actions")] })
          ]
        })
      ],
      body: [
        A.Div({ style: { display: "flex", flexDirection: "column", gap: "12px" } }, {
          default: [
            app.call("Button", {
              text: app.i18n.t("ui.line_modifiers"),
              variant: "outline",
              size: "sm",
              "data-onclick": "order.editModifiers",
              "data-line-id": lineId
            }),
            app.call("Button", {
              text: app.i18n.t("ui.line_notes"),
              variant: "outline",
              size: "sm",
              "data-onclick": "order.editNotes",
              "data-line-id": lineId
            }),
            app.call("Button", {
              text: app.i18n.t("ui.line_discount"),
              variant: "outline",
              size: "sm",
              "data-onclick": "order.editDiscount",
              "data-line-id": lineId
            }),
            app.call("Button", {
              text: app.i18n.t("ui.delete_line"),
              intent: "danger",
              variant: "outline",
              size: "sm",
              "data-onclick": "order.requestRemoveLine",
              "data-line-id": lineId
            })
          ]
        })
      ],
      footer: [
        app.call("Button", {
          text: app.i18n.t("ui.cancel"),
          variant: "ghost",
          "data-onclick": "order.closeLineActions"
        })
      ]
    });
  });

  C.define("POSLineNotesModal", (A, s, app, p = {}) => {
    if (!p.open) return null;
    const lineId = s.ui.overlays?.payload?.lineId;
    const value = s.ui.forms?.notes || "";

    return app.call("Modal", {
      open: p.open,
      size: "md",
      onClose: () => app.dispatch("view.closeOverlay")
    }, {
      header: [
        A.Div({ style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, {
          default: [
            A.Strong({ style: { fontSize: "18px" } }, { default: [app.i18n.t("ui.line_notes")] }),
            app.call("Button", {
              text: "×",
              variant: "ghost",
              size: "sm",
              "data-onclick": "view.closeOverlay"
            })
          ]
        })
      ],
      body: [
        app.call("Textarea", {
          value,
          rows: 5,
          placeholder: app.i18n.t("ui.notes_placeholder"),
          "data-oninput": "order.updateNotesDraft"
        })
      ],
      footer: [
        A.Div({ style: { display: "flex", justifyContent: "flex-end", gap: "12px" } }, {
          default: [
            app.call("Button", {
              text: app.i18n.t("ui.cancel"),
              variant: "ghost",
              "data-onclick": "view.closeOverlay"
            }),
            app.call("Button", {
              text: app.i18n.t("ui.save"),
              intent: "success",
              "data-onclick": "order.saveNotes",
              "data-line-id": lineId
            })
          ]
        })
      ]
    });
  });

  C.define("POSLineModifiersModal", (A, s, app, p = {}) => {
    if (!p.open) return null;
    const payload = s.ui.overlays?.payload || {};
    const lineId = payload.lineId;
    const modifiers = s.modifiers || {};
    const locale = s.env?.locale || "ar";
    const form = s.ui.forms?.modifiers || { addOns: [], removals: [] };
    const selectedAddOns = new Set((form.addOns || []).map((id) => String(id)));
    const selectedRemovals = new Set((form.removals || []).map((id) => String(id)));

    const renderGroup = (list = [], kind = "addOns") =>
      list.map((mod) => {
        const id = String(mod.id);
        const checked = kind === "addOns" ? selectedAddOns.has(id) : selectedRemovals.has(id);
        const label = mod.name?.[locale] || mod.name?.en || mod.id;
        const priceChange = Number(mod.price_change || 0);
        return A.Div({
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 0",
            borderBottom: "1px solid rgba(148,163,184,0.2)"
          }
        }, {
          default: [
            app.call("Checkbox", {
              label,
              checked,
              "data-onchange": "order.toggleModifier",
              "data-modifier-id": mod.id,
              "data-kind": kind
            }),
            priceChange
              ? A.Span({ style: { fontSize: "12px", color: "var(--text-subtle)" } }, {
                  default: [priceChange > 0 ? `+${priceChange}` : priceChange]
                })
              : null
          ]
        });
      });

    return app.call("Modal", {
      open: p.open,
      size: "lg",
      onClose: () => app.dispatch("view.closeOverlay")
    }, {
      header: [
        A.Div({ style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, {
          default: [
            A.Strong({ style: { fontSize: "18px" } }, { default: [app.i18n.t("ui.line_modifiers")] }),
            app.call("Button", {
              text: "×",
              variant: "ghost",
              size: "sm",
              "data-onclick": "view.closeOverlay"
            })
          ]
        })
      ],
      body: [
        A.Div({ style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" } }, {
          default: [
            A.Div({ style: { display: "flex", flexDirection: "column" } }, {
              default: [
                A.Strong({ style: { marginBottom: "6px" } }, { default: [app.i18n.t("ui.add_ons")] }),
                ...renderGroup(modifiers["add-ons"] || [], "addOns")
              ]
            }),
            A.Div({ style: { display: "flex", flexDirection: "column" } }, {
              default: [
                A.Strong({ style: { marginBottom: "6px" } }, { default: [app.i18n.t("ui.removals")] }),
                ...renderGroup(modifiers.removals || [], "removals")
              ]
            })
          ]
        })
      ],
      footer: [
        A.Div({ style: { display: "flex", justifyContent: "flex-end", gap: "12px" } }, {
          default: [
            app.call("Button", {
              text: app.i18n.t("ui.cancel"),
              variant: "ghost",
              "data-onclick": "view.closeOverlay"
            }),
            app.call("Button", {
              text: app.i18n.t("ui.save"),
              intent: "success",
              "data-onclick": "order.saveModifiers",
              "data-line-id": lineId
            })
          ]
        })
      ]
    });
  });

  C.define("POSLineDiscountModal", (A, s, app, p = {}) => {
    if (!p.open) return null;
    const payload = s.ui.overlays?.payload || {};
    const lineId = payload.lineId;
    const form = s.ui.forms?.discount || { type: "percent", value: "" };

    return app.call("Modal", {
      open: p.open,
      size: "sm",
      onClose: () => app.dispatch("view.closeOverlay")
    }, {
      header: [
        A.Div({ style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, {
          default: [
            A.Strong({ style: { fontSize: "18px" } }, { default: [app.i18n.t("ui.line_discount")] }),
            app.call("Button", {
              text: "×",
              variant: "ghost",
              size: "sm",
              "data-onclick": "view.closeOverlay"
            })
          ]
        })
      ],
      body: [
        A.Div({ style: { display: "flex", flexDirection: "column", gap: "12px" } }, {
          default: [
            A.Div({ style: { display: "flex", gap: "12px" } }, {
              default: [
                app.call("Radio", {
                  name: "line-discount-type",
                  label: app.i18n.t("ui.percent"),
                  checked: form.type === "percent",
                  value: "percent",
                  "data-onchange": "order.setDiscountType",
                  "data-type": "percent"
                }),
                app.call("Radio", {
                  name: "line-discount-type",
                  label: app.i18n.t("ui.amount"),
                  checked: form.type === "amount",
                  value: "amount",
                  "data-onchange": "order.setDiscountType",
                  "data-type": "amount"
                })
              ]
            }),
            app.call("Input", {
              type: "number",
              min: "0",
              value: form.value || "",
              placeholder: app.i18n.t("ui.value"),
              "data-oninput": "order.updateDiscountValue"
            })
          ]
        })
      ],
      footer: [
        A.Div({ style: { display: "flex", justifyContent: "flex-end", gap: "12px" } }, {
          default: [
            app.call("Button", {
              text: app.i18n.t("ui.cancel"),
              variant: "ghost",
              "data-onclick": "view.closeOverlay"
            }),
            app.call("Button", {
              text: app.i18n.t("ui.apply"),
              intent: "primary",
              "data-onclick": "order.applyDiscount",
              "data-line-id": lineId
            })
          ]
        })
      ]
    });
  });

  C.define("POSQtyNumpadModal", (A, s, app, p = {}) => {
    if (!p.open) return null;
    const payload = s.ui.overlays?.payload || {};
    const lineId = payload.lineId;
    const form = s.ui.forms?.numpad || { value: "1" };
    const line = (s.order?.lines || []).find((entry) => entry.id === lineId);

    return app.call("Modal", {
      open: p.open,
      size: "sm",
      onClose: () => app.dispatch("view.closeOverlay")
    }, {
      header: [
        A.Div({ style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, {
          default: [
            A.Strong({ style: { fontSize: "18px" } }, { default: [app.i18n.t("ui.enterQuantity")] }),
            app.call("Button", {
              text: "×",
              variant: "ghost",
              size: "sm",
              "data-onclick": "view.closeOverlay"
            })
          ]
        })
      ],
      body: [
        A.Div({ style: { display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" } }, {
          default: [
            line ? A.Span({ style: { fontSize: "14px", color: "var(--text-subtle)" } }, { default: [line.name || "—"] }) : null,
            A.Div({
              style: {
                width: "96px",
                height: "64px",
                borderRadius: "16px",
                border: "1px solid var(--border-default)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "28px",
                fontWeight: 600
              }
            }, { default: [form.value || "0"] }),
            app.call("POSPinPad", {
              keys: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", ".", "⌫"],
              confirmLabel: app.i18n.t("ui.confirm"),
              confirmCommand: "order.numpadConfirm",
              keyCommand: "order.numpadInput",
              clearCommand: "order.numpadClear"
            })
          ]
        })
      ],
      footer: [
        app.call("Button", {
          text: app.i18n.t("ui.cancel"),
          variant: "ghost",
          "data-onclick": "view.closeOverlay"
        })
      ]
    });
  });

  C.define("POSPinPromptModal", (A, s, app, p = {}) => {
    if (!p.open) return null;
    const prompt = s.ui.pinPrompt || {};
    const message = prompt.error || null;

    const reasonLabel = (() => {
      switch (prompt.reason) {
        case "item_discount":
          return app.i18n.t("ui.line_discount");
        case "delete_line":
          return app.i18n.t("ui.delete_line");
        default:
          return app.i18n.t("ui.security_pin");
      }
    })();

    return app.call("Modal", {
      open: p.open,
      size: "sm",
      onClose: () => app.dispatch("security.dismissPin")
    }, {
      header: [
        A.Div({ style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, {
          default: [
            A.Strong({ style: { fontSize: "18px" } }, { default: [reasonLabel] }),
            app.call("Button", {
              text: "×",
              variant: "ghost",
              size: "sm",
              "data-onclick": "security.dismissPin"
            })
          ]
        })
      ],
      body: [
        A.Div({ style: { display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" } }, {
          default: [
            message
              ? A.Span({ style: { color: "var(--danger)", fontWeight: 600 } }, { default: [message] })
              : A.Span({ style: { color: "var(--text-subtle)", fontSize: "13px" } }, { default: [app.i18n.t("ui.security_pin")] }),
            app.call("POSPinPad", {
              confirmLabel: app.i18n.t("ui.confirm"),
              confirmCommand: "security.pinConfirm",
              keyCommand: "security.pinKey",
              clearCommand: "security.pinClear"
            })
          ]
        })
      ],
      footer: [
        app.call("Button", {
          text: app.i18n.t("ui.cancel"),
          variant: "ghost",
          "data-onclick": "security.dismissPin"
        })
      ]
    });
  });

  C.define("POSPaymentsSheet", (A, s, app, p = {}) => {
    if (!p.open) return null;
    const order = s.order;
    if (!order) return null;
    const helpers = app.helpers || {};
    const formatCurrency = helpers.formatCurrency || ((v) => Number(v || 0).toFixed(2));
    const splits = s.payments.splits || [];
    const total = order?.totals?.total || 0;
    const paid = splits.reduce((sum, split) => sum + (split.amount || 0), 0);
    const remaining = Math.max(0, total - paid);
    const buffer = s.payments.buffer || "0";
    const activeMethod = s.payments.method || "cash";

    const paymentKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", ".", "⌫"];

    const methodButtons = [
      { key: "cash", label: app.i18n.t("ui.pay_method_cash") },
      { key: "card", label: app.i18n.t("ui.pay_method_card") },
      { key: "wallet", label: app.i18n.t("ui.pay_method_wallet") }
    ].map((method) => app.call("Button", {
      text: method.label,
      variant: activeMethod === method.key ? "solid" : "outline",
      size: "sm",
      "data-onclick": "payments.setMethod",
      "data-method": method.key
    }));

    const splitRows = splits.map((split) =>
      A.Div({
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid rgba(148,163,184,0.16)",
          padding: "8px 0"
        }
      }, {
        default: [
          A.Div({ style: { display: "flex", flexDirection: "column" } }, {
            default: [
              A.Strong({ style: { fontSize: "13px" } }, { default: [app.i18n.t(`ui.pay_method_${split.method || "cash"}`)] }),
              A.Span({ style: { fontSize: "11px", color: "var(--text-subtle)" } }, { default: [formatCurrency(split.amount || 0)] })
            ]
          }),
          app.call("Button", {
            text: "×",
            variant: "ghost",
            size: "xs",
            "data-onclick": "payments.removeSplit",
            "data-split-id": split.id
          })
        ]
      })
    );

    return app.call("Sheet", {
      open: p.open,
      side: "end",
      size: "lg",
      onClose: () => app.dispatch("payments.close")
    }, {
      header: [
        A.Div({ style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, {
          default: [
            A.Strong({ style: { fontSize: "18px" } }, { default: [app.i18n.t("ui.settle_pay")] }),
            app.call("Button", {
              text: "×",
              variant: "ghost",
              size: "sm",
              "data-onclick": "payments.close"
            })
          ]
        })
      ],
      body: [
        A.Div({ style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" } }, {
          default: [
            A.Div({ style: { display: "flex", flexDirection: "column", gap: "12px" } }, {
              default: [
                A.Div({ style: { display: "flex", flexDirection: "column", gap: "4px" } }, {
                  default: [
                    A.Span({ style: { fontSize: "12px", color: "var(--text-subtle)" } }, { default: [app.i18n.t("ui.amount_due")] }),
                    A.Strong({ style: { fontSize: "20px" } }, { default: [formatCurrency(remaining)] })
                  ]
                }),
                A.Div({ style: { display: "flex", flexDirection: "column", gap: "6px" } }, {
                  default: [
                    A.Span({ style: { fontSize: "12px", color: "var(--text-subtle)" } }, { default: [app.i18n.t("ui.amount_entered")] }),
                    app.call("Input", {
                      value: buffer,
                      readonly: true
                    })
                  ]
                }),
                A.Div({ style: { display: "flex", gap: "8px", flexWrap: "wrap" } }, { default: methodButtons }),
                app.call("POSPinPad", {
                  keys: paymentKeys,
                  confirmLabel: app.i18n.t("ui.add_split"),
                  confirmCommand: "payments.addSplit",
                  keyCommand: "payments.key",
                  clearCommand: "payments.clearBuffer"
                })
              ]
            }),
            A.Div({ style: { display: "flex", flexDirection: "column", gap: "12px" } }, {
              default: [
                A.Div({ style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, {
                  default: [
                    A.Strong({ style: { fontSize: "14px" } }, { default: [app.i18n.t("ui.payment_breakdown")] }),
                    splits.length
                      ? app.call("Button", {
                          text: app.i18n.t("ui.add_split"),
                          variant: "ghost",
                          size: "xs",
                          "data-onclick": "payments.addSplit"
                        })
                      : null
                  ]
                }),
                splitRows.length
                  ? A.Div({ style: { display: "flex", flexDirection: "column", gap: "8px" } }, { default: splitRows })
                  : A.Div({ style: { fontSize: "12px", color: "var(--text-subtle)" } }, { default: [app.i18n.t("ui.splits")] }),
                A.Div({ style: { display: "flex", justifyContent: "space-between", fontWeight: 600 } }, {
                  default: [
                    A.Span({}, { default: [app.i18n.t("ui.payments_total")] }),
                    A.Span({}, { default: [formatCurrency(paid)] })
                  ]
                })
              ]
            })
          ]
        })
      ],
      footer: [
        A.Div({ style: { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" } }, {
          default: [
            remaining > 0
              ? A.Span({ style: { fontSize: "12px", color: "var(--danger)" } }, { default: [app.i18n.t("ui.payment_pending")] })
              : A.Span({ style: { fontSize: "12px", color: "var(--success)" } }, { default: [app.i18n.t("ui.payment_completed")] }),
            A.Div({ style: { display: "flex", gap: "8px" } }, {
              default: [
                app.call("Button", {
                  text: app.i18n.t("ui.cancel"),
                  variant: "ghost",
                  "data-onclick": "payments.close"
                }),
                app.call("Button", {
                  text: app.i18n.t("ui.complete_payment"),
                  intent: "success",
                  "data-onclick": "payments.complete"
                })
              ]
            })
          ]
        })
      ]
    });
  });

  C.define("POSReportsSheet", (A, s, app, p = {}) => {
    if (!p.open) return null;
    return app.call("Sheet", {
      open: p.open,
      side: "end",
      size: "lg",
      onClose: () => app.dispatch("view.closeOverlay")
    }, {
      header: [
        A.Div({ style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, {
          default: [
            A.Strong({ style: { fontSize: "18px" } }, { default: [app.i18n.t("ui.reports")] }),
            app.call("Button", {
              text: "×",
              variant: "ghost",
              size: "sm",
              "data-onclick": "view.closeOverlay"
            })
          ]
        })
      ],
      body: [
        A.Div({
          style: {
            minHeight: "240px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            color: "var(--text-subtle)",
            gap: "12px"
          }
        }, {
          default: [
            A.Strong({}, { default: [app.i18n.t("ui.reports_placeholder")] }),
            A.Span({ style: { fontSize: "13px" } }, { default: [app.i18n.t("ui.reports_placeholder_hint")] })
          ]
        })
      ],
      footer: [
        app.call("Button", {
          text: app.i18n.t("ui.done"),
          variant: "ghost",
          "data-onclick": "view.closeOverlay"
        })
      ]
    });
  });

  C.define("POSShiftSummaryModal", (A, s, app, p = {}) => {
    if (!p.open) return null;
    const shift = s.session?.shift;
    if (!shift) return null;
    const helpers = app.helpers || {};
    const formatCurrency = helpers.formatCurrency || ((v) => Number(v || 0).toFixed(2));
    const computeSummary = helpers.computeShiftSummary || ((state, currentShift) => ({
      openingFloat: currentShift.openingFloat || 0,
      ordersCount: (currentShift.orderIds || []).length,
      totalSales: 0,
      paymentsTotal: 0,
      returnsTotal: 0,
      netSales: 0,
      cashExpected: currentShift.openingFloat || 0,
      totalsByType: { dine_in: 0, takeaway: 0, delivery: 0 },
      paymentsByMethod: { cash: 0, card: 0, wallet: 0 }
    }));
    const summary = computeSummary(s, shift) || {};
    const payload = s.ui.overlays?.payload || {};
    const mode = payload.mode || "view";

    const orderTypeRows = Object.entries(summary.totalsByType || {}).map(([type, value]) =>
      A.Div({ style: { display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-subtle)" } }, {
        default: [A.Span({}, { default: [app.i18n.t(`ui.${type}`)] }), A.Span({}, { default: [formatCurrency(value)] })]
      })
    );

    const paymentRows = Object.entries(summary.paymentsByMethod || {}).map(([method, value]) =>
      A.Div({ style: { display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--text-subtle)" } }, {
        default: [A.Span({}, { default: [app.i18n.t(`ui.pay_method_${method}`) || method] }), A.Span({}, { default: [formatCurrency(value)] })]
      })
    );

    return app.call("Modal", {
      open: p.open,
      size: "lg",
      onClose: () => app.dispatch("view.closeOverlay")
    }, {
      header: [
        A.Div({ style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, {
          default: [
            A.Div({ style: { display: "flex", flexDirection: "column" } }, {
              default: [
                A.Strong({ style: { fontSize: "18px" } }, { default: [app.i18n.t("ui.shift_summary")] }),
                A.Span({ style: { fontSize: "12px", color: "var(--text-subtle)" } }, { default: [`#${shift.id}`] })
              ]
            }),
            app.call("Button", {
              text: "×",
              variant: "ghost",
              size: "sm",
              "data-onclick": "view.closeOverlay"
            })
          ]
        })
      ],
      body: [
        A.Div({ style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" } }, {
          default: [
            A.Div({ style: { border: "1px solid var(--border-default)", borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", gap: "8px" } }, {
              default: [
                A.Div({ style: { display: "flex", justifyContent: "space-between" } }, {
                  default: [
                    A.Span({ style: { color: "var(--text-subtle)", fontSize: "12px" } }, { default: [app.i18n.t("ui.opening_float")] }),
                    A.Strong({}, { default: [formatCurrency(summary.openingFloat || 0)] })
                  ]
                }),
                A.Div({ style: { display: "flex", justifyContent: "space-between" } }, {
                  default: [
                    A.Span({ style: { color: "var(--text-subtle)", fontSize: "12px" } }, { default: [app.i18n.t("ui.orders_count")] }),
                    A.Strong({}, { default: [summary.ordersCount || 0] })
                  ]
                }),
                A.Div({ style: { display: "flex", justifyContent: "space-between" } }, {
                  default: [
                    A.Span({ style: { color: "var(--text-subtle)", fontSize: "12px" } }, { default: [app.i18n.t("ui.gross_sales")] }),
                    A.Strong({}, { default: [formatCurrency(summary.totalSales || 0)] })
                  ]
                }),
                A.Div({ style: { display: "flex", justifyContent: "space-between" } }, {
                  default: [
                    A.Span({ style: { color: "var(--text-subtle)", fontSize: "12px" } }, { default: [app.i18n.t("ui.payments_total")] }),
                    A.Strong({}, { default: [formatCurrency(summary.paymentsTotal || 0)] })
                  ]
                }),
                A.Div({ style: { display: "flex", justifyContent: "space-between" } }, {
                  default: [
                    A.Span({ style: { color: "var(--text-subtle)", fontSize: "12px" } }, { default: [app.i18n.t("ui.returns_total")] }),
                    A.Strong({}, { default: [formatCurrency(summary.returnsTotal || 0)] })
                  ]
                }),
                A.Div({ style: { display: "flex", justifyContent: "space-between", fontWeight: 600 } }, {
                  default: [
                    A.Span({}, { default: [app.i18n.t("ui.net_sales")] }),
                    A.Span({}, { default: [formatCurrency(summary.netSales || 0)] })
                  ]
                }),
                A.Div({ style: { display: "flex", justifyContent: "space-between", fontWeight: 600 } }, {
                  default: [
                    A.Span({}, { default: [app.i18n.t("ui.cash_drawer_expected")] }),
                    A.Span({}, { default: [formatCurrency(summary.cashExpected || 0)] })
                  ]
                })
              ]
            }),
            A.Div({ style: { border: "1px solid var(--border-default)", borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", gap: "8px" } }, {
              default: [
                A.Strong({}, { default: [app.i18n.t("ui.orders_breakdown")] }),
                ...orderTypeRows
              ]
            }),
            A.Div({ style: { border: "1px solid var(--border-default)", borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", gap: "8px" } }, {
              default: [
                A.Strong({}, { default: [app.i18n.t("ui.payment_breakdown")] }),
                ...paymentRows
              ]
            })
          ]
        })
      ],
      footer: [
        A.Div({ style: { display: "flex", justifyContent: "flex-end", gap: "12px" } }, {
          default: [
            app.call("Button", {
              text: app.i18n.t("ui.cancel"),
              variant: "ghost",
              "data-onclick": "view.closeOverlay"
            }),
            mode === "close"
              ? app.call("Button", {
                  text: app.i18n.t("ui.close_shift_confirm"),
                  intent: "danger",
                  "data-onclick": "shift.close"
                })
              : app.call("Button", {
                  text: app.i18n.t("ui.done"),
                  intent: "primary",
                  "data-onclick": "view.closeOverlay"
                })
          ]
        })
      ]
    });
  });

  C.define("POSModalsRoot", (A, s, app) => {
    const active = s.ui.overlays.active;
    return A.Div({
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        pointerEvents: active ? "auto" : "none"
      }
    }, {
      default: [
        app.call("POSTablesModal", { open: active === "tables", uniqueKey: "tables-modal" }),
        app.call("POSReservationsModal", { open: active === "reservations", uniqueKey: "reservations-modal" }),
        app.call("POSReturnsModal", { open: active === "returns", uniqueKey: "returns-modal" }),
        app.call("POSLineActionsSheet", { open: active === "line-actions", uniqueKey: "line-actions-sheet" }),
        app.call("POSLineNotesModal", { open: active === "line-notes", uniqueKey: "line-notes-modal" }),
        app.call("POSLineModifiersModal", { open: active === "line-modifiers", uniqueKey: "line-modifiers-modal" }),
        app.call("POSLineDiscountModal", { open: active === "line-discount", uniqueKey: "line-discount-modal" }),
        app.call("POSQtyNumpadModal", { open: active === "numpad", uniqueKey: "qty-numpad-modal" }),
        app.call("POSPinPromptModal", { open: active === "pin", uniqueKey: "pin-prompt-modal" }),
        app.call("POSPaymentsSheet", { open: active === "payments", uniqueKey: "payments-sheet" }),
        app.call("POSReportsSheet", { open: active === "reports", uniqueKey: "reports-sheet" }),
        app.call("POSShiftSummaryModal", { open: active === "shift-summary", uniqueKey: "shift-summary-modal" })
      ]
    });
  });

  C.define("POSToastsRoot", (A, s, app) => {
    const toasts = s.ui.toasts || [];
    if (!toasts.length) return null;
    return A.Div({
      style: {
        position: "fixed",
        insetInlineEnd: "20px",
        insetBlockStart: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        zIndex: 1500
      }
    }, {
      default: toasts.map((toast) => A.Div({
        style: {
          borderRadius: "14px",
          background: "var(--bg-surface)",
          boxShadow: "0 12px 24px -16px rgba(15,23,42,0.32)",
          padding: "12px 16px",
          minWidth: "240px",
          borderInlineStart: `4px solid ${toast.intent === "success" ? "var(--success)" : toast.intent === "danger" ? "var(--danger)" : "var(--primary)"}`
        }
      }, {
        default: [
          A.Div({ style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" } }, {
            default: [
              A.Div({ style: { display: "flex", flexDirection: "column", gap: "4px" } }, {
                default: [
                  toast.title ? A.Strong({}, { default: [toast.title] }) : null,
                  toast.message ? A.Span({ style: { color: "var(--text-subtle)", fontSize: "12px" } }, { default: [toast.message] }) : null
                ]
              }),
              app.call("Button", {
                text: "×",
                variant: "ghost",
                size: "xs",
                "data-onclick": "ui.dismissToast",
                "data-toast-id": toast.id
              })
            ]
          })
        ]
      }))
    });
  });

    M.__POSComponentsReady = true;
    return true;
  }

  if (!definePOSComponents()) {
    let attempts = 0;
    const maxAttempts = 60;
    let timerId = null;
    const retry = () => {
      attempts += 1;
      if (definePOSComponents() || attempts >= maxAttempts) {
        window.clearInterval(timerId);
        timerId = null;
      }
    };
    timerId = window.setInterval(retry, 20);
    if (window && window.addEventListener) {
      window.addEventListener("mishkah:comp-ready", definePOSComponents, { once: true });
      window.addEventListener("mishkah:core-ready", definePOSComponents, { once: true });
      window.addEventListener("DOMContentLoaded", definePOSComponents, { once: true });
    }
  }

})(window);
