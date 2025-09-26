(function (window) {
  "use strict";

  const M = window.Mishkah || {};
  const C = M.Comp;
  const U = (M.utils) || {};
  if (!C || !window.Mishkah || !window.Mishkah.Atoms) return;

  const cx = (...classes) => classes.filter(Boolean).join(" ");
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  C.define("POSRoot", (A, s, app) => {
    const stage = s.ui.stage;
    if (stage === "login") {
      return app.call("POSLoginScreen", { uniqueKey: "login-screen" });
    }
    if (stage === "shift-setup") {
      return app.call("POSShiftSetup", { uniqueKey: "shift-setup" });
    }
    return app.call("POSViewport", { uniqueKey: "pos-root" });
  });

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
              default: [app.i18n.t("ui.welcome")] }),
            A.P({ style: { fontSize: "1rem", color: "var(--text-subtle)" } }, {
              default: [app.i18n.t("ui.enter_pin")] })
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
      ? "minmax(0, 7fr) minmax(320px, 3fr)"
      : "minmax(320px, 3fr) minmax(0, 7fr)";

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
              text: app.i18n.t("ui.reports"),
              variant: "outline",
              size: "sm",
              "data-onclick": "view.showReports"
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
        A.Div({ style: { display: "flex", flexDirection: "column", gap: "4px" } }, {
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
                A.Span({ style: { minWidth: "32px", textAlign: "center", fontWeight: 600 } }, { default: [line.qty] }),
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
              text: app.i18n.t("ui.remove"),
              variant: "ghost",
              intent: "danger",
              size: "xs",
              "data-onclick": "order.removeLine",
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
        app.call("POSTablesModal", { open: active === "tables" }),
        app.call("POSPaymentsSheet", { open: active === "payments" }),
        app.call("POSReportsSheet", { open: active === "reports" }),
        app.call("POSShiftSummaryModal", { open: active === "shift-summary" })
      ]
    });
  });

  C.define("POSTablesModal", (A, s, app, p) => {
    if (!p.open) return null;
    return app.call("Modal", {
      open: true,
      size: "lg",
      title: app.i18n.t("ui.tables"),
      onClose: () => app.dispatch("view.closeOverlay")
    }, {
      body: [
        A.Div({
          class: "no-scrollbar",
          style: {
            maxHeight: "70vh",
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "12px"
          }
        }, {
          default: (s.tables || []).map((table) => app.call("POSTableCard", { table }))
        })
      ]
    });
  });

  C.define("POSTableCard", (A, s, app, p) => {
    const table = p.table;
    const statusColors = {
      available: "var(--success)",
      occupied: "var(--danger)",
      reserved: "var(--warning, #f59e0b)",
      offline: "#4b5563"
    };
    const badgeColor = statusColors[table.status] || "var(--text-default)";
    return A.Div({
      "data-onclick": "tables.attach",
      "data-table-id": table.id,
      style: {
        borderRadius: "16px",
        border: `2px solid ${badgeColor}`,
        background: "var(--bg-surface)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        cursor: "pointer"
      }
    }, {
      default: [
        A.Strong({ style: { fontSize: "18px" } }, { default: [table.name] }),
        A.Span({ style: { color: "var(--text-subtle)", fontSize: "12px" } }, {
          default: [`${table.seats} ${app.i18n.t("ui.seats")}`]
        }),
        A.Span({ style: { fontSize: "12px", color: badgeColor } }, { default: [app.i18n.t(`ui.table_status_${table.status}`)] })
      ]
    });
  });

  C.define("POSPaymentsSheet", (A, s, app, p) => {
    if (!p.open) return null;
    const helpers = app.helpers || {};
    const f = helpers.formatCurrency || ((v) => v.toFixed(2));
    const order = s.order;
    const total = order ? order.totals.total : 0;
    const splits = s.payments.splits || [];
    const paid = splits.reduce((sum, split) => sum + (split.amount || 0), 0);
    const due = Math.max(0, total - paid);

    return app.call("Sheet", {
      open: true,
      side: "end",
      title: app.i18n.t("ui.settle_pay"),
      size: "md",
      onClose: () => app.dispatch("payments.close")
    }, {
      body: [
        A.Div({ style: { display: "flex", flexDirection: "column", gap: "16px" } }, {
          default: [
            A.Div({ style: { textAlign: "center" } }, {
              default: [
                A.Span({ style: { display: "block", color: "var(--text-subtle)" } }, { default: [app.i18n.t("ui.total")] }),
                A.Strong({ style: { fontSize: "28px" } }, { default: [f(total)] }),
                A.Span({ style: { display: "block", marginTop: "8px", color: due === 0 ? "var(--success)" : "var(--danger)" } }, {
                  default: [due === 0 ? app.i18n.t("ui.paid_in_full") : `${app.i18n.t("ui.remaining")}: ${f(due)}`]
                })
              ]
            }),
            app.call("POSPaymentMethods", { current: s.payments.method || "cash" }),
            app.call("POSPaymentAmountPad", {
              buffer: s.payments.buffer || "0",
              confirmDisabled: due === 0,
              due
            }),
            splits.length ? A.Div({ style: { borderTop: "1px solid var(--border-default)", paddingTop: "12px" } }, {
              default: [
                A.Div({ style: { fontWeight: 600, marginBottom: "8px" } }, { default: [app.i18n.t("ui.splits")] }),
                A.Div({ style: { display: "flex", flexDirection: "column", gap: "8px" } }, {
                  default: splits.map((split) => A.Div({
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderRadius: "12px",
                      background: "var(--bg-page)",
                      padding: "8px 12px"
                    }
                  }, {
                    default: [
                      A.Span({}, { default: [app.i18n.t(`ui.pay_method_${split.method}`)] }),
                      A.Div({ style: { display: "flex", gap: "8px", alignItems: "center" } }, {
                        default: [
                          A.Strong({}, { default: [f(split.amount)] }),
                          app.call("Button", {
                            text: app.i18n.t("ui.remove"),
                            variant: "ghost",
                            size: "xs",
                            "data-onclick": "payments.removeSplit",
                            "data-split-id": split.id
                          })
                        ]
                      })
                    ]
                  }))
                })
              ]
            }) : null
          ]
        })
      ],
      footer: [
        app.call("Button", {
          text: app.i18n.t("ui.complete_payment"),
          intent: "success",
          disabled: due > 0,
          "data-onclick": "payments.complete"
        })
      ]
    });
  });

  C.define("POSPaymentMethods", (A, s, app, p) => {
    const methods = [
      { id: "cash", label: app.i18n.t("ui.cash") },
      { id: "card", label: app.i18n.t("ui.card") },
      { id: "wallet", label: app.i18n.t("ui.wallet") }
    ];
    return A.Div({
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
        gap: "8px"
      }
    }, {
      default: methods.map((method) => A.Button({
        type: "button",
        "data-onclick": "payments.setMethod",
        "data-method": method.id,
        style: {
          borderRadius: "14px",
          border: `1px solid ${p.current === method.id ? "var(--primary)" : "var(--border-default)"}`,
          padding: "10px",
          background: p.current === method.id ? "var(--primary-soft, rgba(99,102,241,0.18))" : "var(--bg-page)"
        }
      }, { default: [method.label] }))
    });
  });

  C.define("POSPaymentAmountPad", (A, s, app, p) => {
    const buffer = p.buffer || "0";
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", ".", "⌫"];
    return A.Div({
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }
    }, {
      default: [
        A.Div({
          style: {
            borderRadius: "16px",
            border: "1px solid var(--border-default)",
            padding: "12px",
            fontSize: "24px",
            textAlign: "center",
            background: "var(--bg-page)",
            fontWeight: 600
          }
        }, { default: [buffer] }),
        A.Div({
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "8px"
          }
        }, {
          default: keys.map((key) => app.call("Button", {
            text: key,
            variant: "ghost",
            style: { height: "52px", borderRadius: "16px", fontSize: "18px" },
            "data-onclick": "payments.key",
            "data-key": key
          }))
        }),
        A.Div({ style: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px" } }, {
          default: [
            app.call("Button", {
              text: app.i18n.t("ui.clear"),
              variant: "outline",
              "data-onclick": "payments.clearBuffer"
            }),
            app.call("Button", {
              text: app.i18n.t("ui.add_split"),
              intent: "primary",
              disabled: p.due <= 0,
              "data-onclick": "payments.addSplit"
            })
          ]
        })
      ]
    });
  });

  C.define("POSShiftSummaryModal", (A, s, app, p) => {
    if (!p.open) return null;
    const shift = s.session.shift;
    const helpers = app.helpers || {};
    const f = helpers.formatCurrency || ((v) => v.toFixed(2));
    return app.call("Modal", {
      open: true,
      size: "sm",
      title: app.i18n.t("ui.shift_summary"),
      onClose: () => app.dispatch("view.closeOverlay")
    }, {
      body: [
        shift ? app.call("DescriptionList", {
          items: [
            { term: app.i18n.t("ui.shift"), details: `#${shift.id}` },
            { term: app.i18n.t("ui.start_time"), details: shift.startedAt || "—" },
            { term: app.i18n.t("ui.opening_float"), details: f(shift.openingFloat || 0) },
            { term: app.i18n.t("ui.orders_count"), details: (shift.orderIds || []).length }
          ]
        }) : app.call("EmptyState", { title: app.i18n.t("ui.no_shift") })
      ],
      footer: [
        app.call("Button", {
          text: app.i18n.t("ui.close_shift"),
          intent: "danger",
          "data-onclick": "shift.close"
        })
      ]
    });
  });

  C.define("POSReportsSheet", (A, s, app, p) => {
    if (!p.open) return null;
    return app.call("Sheet", {
      open: true,
      side: "start",
      size: "lg",
      title: app.i18n.t("ui.reports"),
      onClose: () => app.dispatch("view.closeOverlay")
    }, {
      body: [
        app.call("EmptyState", { title: app.i18n.t("ui.reports_placeholder"), text: app.i18n.t("ui.reports_placeholder_hint") })
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

})(window);
