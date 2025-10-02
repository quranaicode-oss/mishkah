// mishkah-ui.js — Modern UI (tokens + components + working events)
(function (w){
'use strict';

const M = w.Mishkah, U = M.utils, h = M.DSL;
const { tw, token, def, cx } = U.twcss;

/* ===================== Tokens (Design System) ===================== */
def({
  // base & layout
  'surface':        'bg-[var(--background)] text-[var(--foreground)]',
  'hstack':         'flex items-center gap-2',
  'vstack':         'flex flex-col gap-2',
  'divider':        'h-px bg-[var(--border)]',
  'ring-base':      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]',
  'scrollarea':     'overflow-auto [scrollbar-gutter:stable] pr-2',

  // buttons
  'btn':            'inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius)] text-sm font-medium transition-colors ring-base disabled:opacity-50 disabled:pointer-events-none',
  'btn/sm': 'h-9  px-3',
  'btn/md': 'h-10 px-3',   
  'btn/lg': 'h-11 px-5',
  'btn/solid':      'bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[color-mix(in oklab,var(--primary) 90%, black)]',
  'btn/soft':       'bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[color-mix(in oklab,var(--secondary) 85%, black)]',
  'btn/ghost':      'hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]',
  'btn/link':       'text-[var(--primary)] underline underline-offset-4 hover:underline',
  'btn/destructive':'bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:bg-[color-mix(in oklab,var(--destructive) 88%, black)]',
  'btn/icon': 'w-10 h-10 p-0 aspect-square',
  'btn/with-icon': 'gap-2',

  // card / panels
  'card':           'rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)] shadow-[var(--shadow)]',
  'card/soft-1':    'rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-1)] text-[var(--card-foreground)] shadow-[var(--shadow)]',
  'card/soft-2':    'rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--card-foreground)] shadow-[var(--shadow)]',
  'card/header':    'flex flex-col space-y-1.5 p-6',
  'card/content':   'p-6 pt-0',
  'card/footer':    'flex items-center p-6 pt-0',
  'card/title':     'text-lg font-semibold leading-none tracking-tight',
  'card/desc':      'text-sm text-[var(--muted-foreground)]',

  // bars
  'toolbar':        'flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[color-mix(in oklab,var(--background) 85%, transparent)] backdrop-blur-sm',
  'footerbar':      'flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)]',

  // inputs
  'input':          'flex h-10 w-full rounded-[var(--radius)] border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:opacity-50 disabled:pointer-events-none',
  'label':          'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',

  // overlay
  'modal-root':     'fixed inset-0 z-50 grid place-items-center',
  'backdrop':       'absolute inset-0 bg-black/60 backdrop-blur-sm',
  'modal-card':     'relative z-10 w-[min(560px,92vw)] card',

  // tabs
  'tabs/row':       'flex items-center gap-2 flex-wrap',
  'tabs/btn':       'px-3 py-1.5 rounded-full hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]',
  'tabs/btn-active':'bg-[var(--primary)] text-[var(--primary-foreground)]',

  // drawer
  'drawer/side':    'fixed inset-y-0 w-[280px] border-s bg-[var(--card)] text-[var(--card-foreground)] shadow-[var(--shadow)]',
  'drawer/body':    'p-4 h-full flex flex-col gap-2',

  // toast
  'toast/host':     'fixed z-50 bottom-3 inset-x-0 px-3',
  'toast/col':      'flex flex-col gap-2 max-w-[560px] mx-auto',
  'toast/item':     'card p-3 flex items-center gap-2'
});

/* ===================== Helpers ===================== */
function withClass(attrs, add){ const a=Object.assign({},attrs||{}); a.class = tw(cx(add, a.class||'')); return a }

/* ===================== Components ===================== */
const UI = {};

UI.AppRoot = ({ shell, overlays }) =>
  h.Containers.Div({ attrs:{ class: tw`${token('surface')} min-h-screen` }}, [ shell, ...(overlays||[]) ]);

UI.Toolbar = ({ left=[], right=[] }) =>
  h.Containers.Header({ attrs:{ class: tw`${token('toolbar')}` }}, [
    h.Containers.Div({ attrs:{ class: tw`${token('hstack')}` }}, left),
    h.Containers.Div({ attrs:{ class: tw`${token('hstack')}` }}, right),
  ]);

UI.Footerbar = ({ left=[], right=[] }) =>
  h.Containers.Footer({ attrs:{ class: tw`${token('footerbar')}` }}, [
    h.Containers.Div({ attrs:{ class: tw`${token('hstack')}` }}, left),
    h.Containers.Div({ attrs:{ class: tw`${token('hstack')}` }}, right),
  ]);

UI.HStack  = ({ attrs }, ch)=> h.Containers.Div({ attrs: withClass(attrs, token('hstack')) }, ch||[]);
UI.VStack  = ({ attrs }, ch)=> h.Containers.Div({ attrs: withClass(attrs, token('vstack')) }, ch||[]);
UI.Divider = ()=> h.Containers.Div({ attrs:{ class: tw`${token('divider')}` }});

UI.Button = ({ attrs={}, variant='soft', size='md' }, children)=>
  h.Forms.Button({ attrs: withClass(attrs, cx(token('btn'), token(`btn/${variant}`), token(`btn/${size}`))) }, children||[]);

UI.Card = ({ title, description, content, footer, variant='card' })=>{
  const root = token(variant)||token('card');
  return h.Containers.Section({ attrs:{ class: tw`${root}` }}, [
    (title||description) && h.Containers.Div({ attrs:{ class: tw`${token('card/header')}` }}, [
      title && h.Text.H3({ attrs:{ class: tw`${token('card/title')}` }}, [title]),
      description && h.Text.P({ attrs:{ class: tw`${token('card/desc')}` }}, [description])
    ]),
    content && h.Containers.Div({ attrs:{ class: tw`${token('card/content')}` }}, [content]),
    footer && h.Containers.Div({ attrs:{ class: tw`${token('card/footer')}` }}, [footer]),
  ].filter(Boolean))
};

UI.Input    = ({ attrs }) => h.Inputs.Input({ attrs: withClass(attrs, token('input')) });
UI.Textarea = ({ attrs }) => h.Inputs.Textarea({ attrs: withClass(attrs, token('input')) });
UI.Select   = ({ attrs={}, options=[] }) =>
  h.Inputs.Select({ attrs: withClass(attrs, token('input')) },
    options.map((o,i)=> h.Inputs.Option({ attrs:{ value:o.value, key:`opt-${i}` }}, [o.label]) )
  );
UI.Label    = ({ attrs, forId, text }) => {
  const a=Object.assign({},attrs||{}); if(forId) a.for=forId;
  return h.Forms.Label({ attrs: withClass(a, token('label')) }, [text||'']);
};
UI.Field = ({ id, label, control, helper }) =>
  UI.VStack({ attrs:{ class: tw`gap-1` }}, [
    label && UI.Label({ forId:id, text:label }),
    control,
    helper && h.Text.Span({ attrs:{ class: tw`text-xs text-[var(--muted-foreground)]` }}, [helper])
  ]);

UI.Tabs = ({ items=[], activeId, gkey='ui:tabs:select' })=>{
  const header = h.Containers.Div({ attrs:{ class: tw`${token('tabs/row')}` }}, items.map(it=>{
    const active = it.id===activeId;
    return UI.Button({
      attrs:{ gkey, 'data-tab-id':it.id, class: tw`${active? token('tabs/btn-active'): token('tabs/btn')}` },
      variant:'ghost', size:'sm'
    }, [it.label]);
  }));
  const panels = items.map(it=>{
    const hidden = it.id!==activeId;
    return h.Containers.Section({ attrs:{ class: tw`${hidden?'hidden':''}`, key:`panel-${it.id}` }}, [
      typeof it.content==='function'? it.content(): it.content
    ]);
  });
  return UI.VStack({}, [header, ...panels]);
};

UI.Drawer = ({ open=false, side='start', header, content })=>{
  if(!open) return h.Containers.Div({ attrs:{ class: tw`hidden` }});
  const isRTL = (document.documentElement.getAttribute('dir')||'ltr')==='rtl';
  const start = isRTL? 'right-0':'left-0';
  const end   = isRTL? 'left-0':'right-0';
  const place = side==='start'? start: end;
  return h.Containers.Div({ attrs:{ class: tw`${token('modal-root')}` }}, [
    h.Containers.Div({ attrs:{ class: tw`absolute inset-0`, gkey:'ui:drawer:close' }}, [
      h.Containers.Div({ attrs:{ class: tw`${token('backdrop')}` }})
    ]),
    h.Containers.Aside({ attrs:{ class: tw`${token('drawer/side')} ${place}` }}, [
      h.Containers.Div({ attrs:{ class: tw`${token('drawer/body')}` }}, [ header, content ])
    ])
  ]);
};

UI.Modal = ({ open=false, title, description, actions=[] })=>{
  if(!open) return h.Containers.Div({ attrs:{ class: tw`hidden` }});
  return h.Containers.Div({ attrs:{ class: tw`${token('modal-root')}` }}, [
    h.Containers.Div({ attrs:{ class: tw`${token('backdrop')}`, gkey:'ui:modal:close' }}),
    h.Containers.Section({ attrs:{ class: tw`${token('modal-card')}` }}, [
      h.Containers.Div({ attrs:{ class: tw`${token('card/header')}` }}, [
        title && h.Text.H3({ attrs:{ class: tw`${token('card/title')}` }}, [title]),
        description && h.Text.P({ attrs:{ class: tw`${token('card/desc')}` }}, [description])
      ]),
      h.Containers.Div({ attrs:{ class: tw`${token('card/footer')}` }}, actions)
    ])
  ]);
};

UI.Table = ({ columns=[], rows=[] })=>
  h.Tables.Table({ attrs:{ class: tw`w-full text-sm border-separate [border-spacing:0_8px]` }}, [
    h.Tables.Thead({}, [
      h.Tables.Tr({}, columns.map((c,i)=> h.Tables.Th({ attrs:{ key:`h-${i}`, class: tw`text-right text-[var(--muted-foreground)] font-medium` }}, [c.label])))
    ]),
    h.Tables.Tbody({}, rows.map((r,ri)=> h.Tables.Tr({ attrs:{ key:`r-${ri}`, class: tw`bg-[var(--surface-1)] rounded-[var(--radius)] shadow-[var(--shadow)]` }},
      columns.map((c,ci)=> h.Tables.Td({ attrs:{ key:`c-${ri}-${ci}`, class: tw`px-4 py-2` }}, [String(r[c.key])]))
    )))
  ]);

UI.ToastHost = ({ toasts=[] })=>
  h.Containers.Div({ attrs:{ class: tw`${token('toast/host')}` }}, [
    h.Containers.Div({ attrs:{ class: tw`${token('toast/col')}` }}, toasts.map((t)=>(
      h.Containers.Div({ attrs:{ key:`to-${t.id}`, class: tw`${token('toast/item')}` }}, [
        t.icon && h.Text.Span({}, [t.icon]),
        h.Containers.Div({}, [
          h.Text.Span({ attrs:{ class: tw`font-semibold` }}, [t.title||'']),
          t.message && h.Text.P({ attrs:{ class: tw`text-[var(--muted-foreground)] text-sm` }}, [t.message])
        ])
      ])
    )))
  ]);
let _toId=1;
UI.pushToast = (ctx,{ title, message, icon, ttl=2800 })=>{
  ctx.setState(s=>{
    const list=(s.ui?.toasts||[]).concat([{ id:_toId++, title, message, icon }]);
    return { ...s, ui:{ ...(s.ui||{}), toasts:list } };
  });
  ctx.rebuild();
  const id=_toId-1;
  setTimeout(()=>{
    const st=ctx.getState();
    const list=(st.ui?.toasts||[]).filter(t=> t.id!==id);
    ctx.setState(s=>({ ...s, ui:{ ...(s.ui||{}), toasts:list } })); ctx.rebuild();
  }, ttl);
};

UI.AppShell = ({ header, sidebar, content, footer })=>
  h.Containers.Main({ attrs:{ class: tw`min-h-screen` }}, [
    header,
    h.Containers.Div({ attrs:{ class: tw`flex` }}, [
      sidebar && h.Containers.Aside({ attrs:{ class: tw`hidden md:block w-[260px] border-e` }}, [ sidebar ]),
      h.Containers.Section({ attrs:{ class: tw`flex-1 p-4` }}, [ content ])
    ]),
    footer
  ]);
UI.CounterCard = ({ value=0, gkeyInc, gkeyDec }) =>
  UI.Card({
    content: h.Containers.Div({ attrs:{ class: tw`flex items-center justify-center gap-3` }}, [
      UI.Button({ attrs:{ gkey:gkeyDec }, variant:'soft', size:'sm' }, ['−']),
      h.Text.Span({ attrs:{ class: tw`text-xl font-bold` }}, [String(value)]),
      UI.Button({ attrs:{ gkey:gkeyInc }, variant:'soft', size:'sm' }, ['+']),
    ])
  });


/* ===================== Built-in Orders (tabs/modal/drawer + routing) ===================== */
const ORDERS = {
  'ui.tabs.select': { on:['click'], gkeys:['ui:tabs:select'], handler:(e,ctx)=>{
    const btn = e.target && (e.target.closest && e.target.closest('[data-tab-id]'));
    if(!btn) return; const id=btn.getAttribute('data-tab-id');
    ctx.setState(s=>({ ...s, ui:{ ...(s.ui||{}), activeTab:id } })); ctx.rebuild();
  }},
  'ui.modal.open':  { on:['click'], gkeys:['ui:modal:open'],  handler:(e,ctx)=>{ ctx.setState(s=>({ ...s, ui:{ ...(s.ui||{}), modalOpen:true } })); ctx.rebuild(); } },
  'ui.modal.close': { on:['click'], gkeys:['ui:modal:close'], handler:(e,ctx)=>{ ctx.setState(s=>({ ...s, ui:{ ...(s.ui||{}), modalOpen:false } })); ctx.rebuild(); } },
  'ui.drawer.toggle':{on:['click'], gkeys:['ui:drawer:toggle'],handler:(e,ctx)=>{ const cur=!!ctx.getState().ui?.drawerOpen; ctx.setState(s=>({ ...s, ui:{ ...(s.ui||{}), drawerOpen:!cur } })); ctx.rebuild(); } },
  'ui.drawer.close': {on:['click'], gkeys:['ui:drawer:close'], handler:(e,ctx)=>{ ctx.setState(s=>({ ...s, ui:{ ...(s.ui||{}), drawerOpen:false } })); ctx.rebuild(); } },

  // Routing (Dashboard / Inventory / Sales)
  'route.dashboard': { on:['click'], gkeys:['route:dashboard'], handler:(e,ctx)=>{ ctx.setState(s=>({ ...s, ui:{ ...(s.ui||{}), route:'dashboard' } })); ctx.rebuild(); } },
  'route.inventory': { on:['click'], gkeys:['route:inventory'], handler:(e,ctx)=>{ ctx.setState(s=>({ ...s, ui:{ ...(s.ui||{}), route:'inventory' } })); ctx.rebuild(); } },
  'route.sales':     { on:['click'], gkeys:['route:sales'],     handler:(e,ctx)=>{ ctx.setState(s=>({ ...s, ui:{ ...(s.ui||{}), route:'sales' } })); ctx.rebuild(); } }
};

M.UI = UI;
M.UI.orders = ORDERS;

})(window);
//markdown


(function(window) {
    'use strict';
    const M = window.Mishkah = window.Mishkah || {};
    const U = M.utils = M.utils || {};
	const h = M.DSL;
	const tw = U.twcss.tw;
    const SimpleMarkdownRenderer = ({ content }) => {
        if (!content) return h.Text.P({}, ["لا يوجد محتوى"]);
        
        const lines = content.split('\n');
        const elements = [];
        let inCodeBlock = false;
        let codeContent = [];
        let currentList = null;

        const createTextElement = (text) => {
            if (!text || text.trim() === '') return null;
            
            // معالجة النص الغني
            const parts = [];
            let buffer = '';
            let inBold = false;
            let inCode = false;

            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                const nextChar = text[i + 1];

                if (char === '`' && !inBold) {
                    if (inCode) {
                        parts.push(h.Text.Code({ 
                            attrs: { class: tw`md-code` } 
                        }, [buffer]));
                        buffer = '';
                        inCode = false;
                    } else {
                        if (buffer) parts.push(buffer);
                        buffer = '';
                        inCode = true;
                    }
                } else if (char === '*' && nextChar === '*' && !inCode) {
                    if (inBold) {
                        parts.push(h.Text.Strong({}, [buffer]));
                        buffer = '';
                        inBold = false;
                        i++;
                    } else {
                        if (buffer) parts.push(buffer);
                        buffer = '';
                        inBold = true;
                        i++;
                    }
                } else {
                    buffer += char;
                }
            }

            if (buffer) {
                if (inBold) {
                    parts.push(h.Text.Strong({}, [buffer]));
                } else if (inCode) {
                    parts.push(h.Text.Code({ 
                        attrs: { class: tw`md-code` } 
                    }, [buffer]));
                } else {
                    parts.push(buffer);
                }
            }

            return parts.length === 1 ? parts[0] : parts;
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (inCodeBlock) {
                if (line.startsWith('```')) {
                    elements.push(
                        h.Text.Pre({
                            attrs: { 
                                class: tw`md-pre`,
                                key: `pre-${elements.length}`
                            }
                        }, [
                            h.Text.Code({}, codeContent.join('\n'))
                        ])
                    );
                    inCodeBlock = false;
                    codeContent = [];
                } else {
                    codeContent.push(lines[i]); // حفظ السطر كما هو مع المسافات
                }
                continue;
            }

            if (line.startsWith('```')) {
                inCodeBlock = true;
                continue;
            }

            if (line.startsWith('# ')) {
                elements.push(
                    h.Text.H1({
                        attrs: { 
                            class: tw`md-h1`,
                            key: `h1-${elements.length}`
                        }
                    }, [line.substring(2)])
                );
                continue;
            }

            if (line.startsWith('## ')) {
                elements.push(
                    h.Text.H2({
                        attrs: { 
                            class: tw`md-h2`,
                            key: `h2-${elements.length}`
                        }
                    }, [line.substring(3)])
                );
                continue;
            }

            if (line.startsWith('### ')) {
                elements.push(
                    h.Text.H3({
                        attrs: { 
                            class: tw`md-h3`,
                            key: `h3-${elements.length}`
                        }
                    }, [line.substring(4)])
                );
                continue;
            }

            if (line.startsWith('> ')) {
                elements.push(
                    h.Text.Blockquote({
                        attrs: { 
                            class: tw`md-blockquote`,
                            key: `blockquote-${elements.length}`
                        }
                    }, [
                        h.Text.P({}, [createTextElement(line.substring(2))])
                    ])
                );
                continue;
            }

            if (line.startsWith('- ') || line.startsWith('* ')) {
                if (!currentList) {
                    currentList = h.Lists.Ul({
                        attrs: { 
                            key: `ul-${elements.length}`
                        }
                    }, []);
                    elements.push(currentList);
                }
                const listItem = h.Lists.Li({}, [createTextElement(line.substring(2))]);
                currentList.children = currentList.children ? [...currentList.children, listItem] : [listItem];
                continue;
            }

            if (line === '') {
                currentList = null;
                continue;
            }

            // النص العادي
            if (line.trim()) {
                elements.push(
                    h.Text.P({
                        attrs: { 
                            class: tw`md-p`,
                            key: `p-${elements.length}`
                        }
                    }, [createTextElement(line)])
                );
            }
        }

        return h.Containers.Article({
            attrs: { 
                class: tw`md-container`,
                key: 'markdown-article'
            }
        }, elements.filter(Boolean));
    };

    U.UDM = SimpleMarkdownRenderer;
    
})(window);