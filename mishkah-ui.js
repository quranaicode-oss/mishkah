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
  'scrollarea':     'overflow-y-auto overscroll-contain [scrollbar-gutter:stable] pr-2',
  'split':          'flex items-center justify-between gap-2',
  'muted':          'text-[var(--muted-foreground)]',

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

  // badges & chips
  'badge':          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-[var(--accent)] text-[var(--accent-foreground)]',
  'badge/ghost':    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-transparent text-[var(--muted-foreground)] border border-[var(--border)]',
  'chip':           'inline-flex items-center gap-2 rounded-full border border-transparent px-3 py-1.5 text-sm transition-colors cursor-pointer bg-[var(--surface-1)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]',
  'chip/active':    'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[var(--shadow)]',
  'pill':           'inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs text-[var(--muted-foreground)]',

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
  'toolbar':        'flex shrink-0 items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[color-mix(in oklab,var(--background) 85%, transparent)] backdrop-blur-sm',
  'footerbar':      'flex shrink-0 items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--card)] text-[var(--card-foreground)]',

  // inputs
  'input':          'flex h-10 w-full rounded-[var(--radius)] border border-[var(--input)] bg-[var(--background)] px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:opacity-50 disabled:pointer-events-none',
  'label':          'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',

  // overlay
  'modal-root':     'fixed inset-0 z-50 grid place-items-center px-4 py-8 sm:py-12 overflow-y-auto',
  'backdrop':       'absolute inset-0 bg-black/70 backdrop-blur-sm',
  'modal-card':     'relative z-10 w-[min(680px,94vw)] max-h-[90vh] card flex flex-col overflow-hidden shadow-[0_20px_40px_-20px_rgba(0,0,0,0.45)]',
  'modal/header':   'flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-[var(--border)] bg-[color-mix(in oklab,var(--card) 96%, transparent)]',
  'modal/body':     'flex-1 overflow-y-auto px-6 py-4',
  'modal/footer':   'flex flex-col sm:flex-row gap-2 px-6 py-4 border-t border-[var(--border)] bg-[color-mix(in oklab,var(--card) 96%, transparent)]',

  // tabs
  'tabs/row':       'flex items-center gap-2 flex-wrap',
  'tabs/btn':       'px-3 py-1.5 rounded-full hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]',
  'tabs/btn-active':'bg-[var(--primary)] text-[var(--primary-foreground)]',

  // drawer
  'drawer/side':    'fixed inset-y-0 w-[280px] border-s bg-[var(--card)] text-[var(--card-foreground)] shadow-[var(--shadow)]',
  'drawer/body':    'p-4 h-full flex flex-col gap-2',

  // list
  'list':           'flex flex-col gap-2',
  'list/item':      'flex items-start gap-3 rounded-[var(--radius)] border border-transparent bg-[var(--surface-1)] px-3 py-2 transition hover:border-[var(--border)]',
  'list/item-leading': 'flex items-center justify-center rounded-[var(--radius)] bg-[var(--surface-2)] text-xl w-10 h-10',
  'list/item-content': 'flex flex-col gap-1 text-sm',
  'list/item-trailing': 'ms-auto flex items-center gap-2 text-sm',

  // empty state
  'empty':          'flex flex-col items-center justify-center gap-2 text-center py-12 text-[var(--muted-foreground)]',

  // support
  'badge/status':   'inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full',
  'status/online':  'bg-emerald-500/15 text-emerald-500',
  'status/offline': 'bg-rose-500/15 text-rose-400',
  'status/idle':    'bg-amber-500/15 text-amber-500',
  'stat/card':      'rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] p-4 flex flex-col gap-3',
  'stat/value':     'text-2xl font-semibold text-[var(--primary)]',
  'scroll-panel':   'rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] flex flex-col overflow-hidden',
  'scroll-panel/head': 'px-4 py-3 border-b border-[var(--border)] flex items-center justify-between gap-2',
  'scroll-panel/body': 'flex-1 min-h-0',
  'scroll-panel/footer': 'px-4 py-3 border-t border-[var(--border)]',

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
  h.Containers.Div({ attrs:{ class: tw`${token('surface')} flex h-screen min-h-screen flex-col overflow-hidden` }}, [ shell, ...(overlays||[]) ]);

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
UI.NumpadDecimal = ({ attrs={}, value='', placeholder='0', gkey, confirmLabel='OK', confirmAttrs={}, title, inputAttrs={}, allowDecimal=true })=>{
  const rootAttrs = withClass(attrs, tw`flex flex-col gap-3`);
  rootAttrs['data-numpad-root'] = 'decimal';
  if(!allowDecimal) rootAttrs['data-numpad-no-decimal'] = 'true';
  const current = value === undefined || value === null ? '' : String(value);
  const display = current !== '' ? current : placeholder || '0';
  const hiddenAttrs = Object.assign({ type:'text', value: current, 'data-numpad-input':'true', class: tw`hidden` }, inputAttrs || {});
  if(gkey) hiddenAttrs.gkey = gkey;
  const digits = ['7','8','9','4','5','6','1','2','3','0','.'];
  const confirmVariant = confirmAttrs.variant || 'solid';
  const confirmSize = confirmAttrs.size || 'md';
  const confirmButtonAttrs = Object.assign({}, confirmAttrs || {});
  delete confirmButtonAttrs.variant;
  delete confirmButtonAttrs.size;
  if(!('data-numpad-confirm' in confirmButtonAttrs)) confirmButtonAttrs['data-numpad-confirm'] = 'true';
  if(!('gkey' in confirmButtonAttrs)) confirmButtonAttrs.gkey = 'ui:numpad:decimal:confirm';
  confirmButtonAttrs.class = tw(cx('flex-1', confirmButtonAttrs.class || ''));
  return h.Containers.Div({ attrs: rootAttrs }, [
    h.Inputs.Input({ attrs: hiddenAttrs }),
    title ? h.Text.Span({ attrs:{ class: tw`text-sm font-medium` }}, [title]) : null,
    h.Containers.Div({ attrs:{ class: tw`rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-1)] px-4 py-5 text-center text-3xl font-semibold tracking-widest text-[var(--foreground)]` }}, [display]),
    h.Containers.Div({ attrs:{ class: tw`grid grid-cols-3 gap-2` }},
      digits.map(key=>{
        const btnAttrs = { gkey:'ui:numpad:decimal:key', 'data-numpad-key':key };
        if(key === '.' && !allowDecimal){ btnAttrs.disabled = true; }
        return UI.Button({ attrs: btnAttrs, variant:'ghost', size:'lg' }, [key]);
      })
    ),
    UI.HStack({ attrs:{ class: tw`gap-2` }}, [
      UI.Button({ attrs:{ gkey:'ui:numpad:decimal:clear', 'data-numpad-clear':'true' }, variant:'ghost', size:'md' }, ['C']),
      UI.Button({ attrs:{ gkey:'ui:numpad:decimal:backspace', 'data-numpad-backspace':'true' }, variant:'ghost', size:'md' }, ['⌫']),
      UI.Button({ attrs: confirmButtonAttrs, variant: confirmVariant, size: confirmSize }, [confirmLabel || 'OK'])
    ])
  ].filter(Boolean));
};
UI.Field = ({ id, label, control, helper }) =>
  UI.VStack({ attrs:{ class: tw`gap-1` }}, [
    label && UI.Label({ forId:id, text:label }),
    control,
    helper && h.Text.Span({ attrs:{ class: tw`text-xs text-[var(--muted-foreground)]` }}, [helper])
  ]);

UI.Badge = ({ attrs={}, variant='badge', leading, trailing, text })=>{
  const parts = [];
  if (leading) parts.push(h.Text.Span({}, [leading]));
  if (text) parts.push(typeof text==='string'? text: text);
  if (trailing) parts.push(h.Text.Span({}, [trailing]));
  return h.Text.Span({ attrs: withClass(attrs, token(variant)||token('badge')) }, parts);
};

UI.Chip = ({ label, active=false, attrs={} })=>{
  const cls = cx(token('chip'), active? token('chip/active'): '');
  const buttonAttrs = Object.assign({ type:'button' }, attrs||{});
  if(attrs && Object.prototype.hasOwnProperty.call(attrs, 'gkey')){
    buttonAttrs.gkey = attrs.gkey;
  }
  return h.Forms.Button({ attrs: withClass(buttonAttrs, cls) }, [label]);
};

UI.ChipGroup = ({ items=[], activeId, attrs={} })=>
  h.Containers.Div({ attrs: withClass(attrs, tw`flex flex-wrap gap-2`) },
    items.map((it)=>{
      const baseAttrs = Object.assign({ 'data-chip-id': it.id }, it.attrs || {});
      if(!('gkey' in baseAttrs) && it.gkey){
        baseAttrs.gkey = it.gkey;
      }
      return UI.Chip({
        label: it.label,
        active: it.id===activeId,
        attrs: baseAttrs
      });
    })
  );

UI.ScrollArea = ({ attrs={}, children=[] })=>
  h.Containers.Div({ attrs: withClass(attrs, token('scrollarea')) }, children);

UI.SearchBar = ({ value='', placeholder='', attrs={}, gkeySubmit, onInput, leading='🔍', trailing=[] })=>{
  const inputAttrs = withClass({
    type:'search',
    placeholder,
    value,
    gkey:onInput
  }, tw`bg-transparent border-0 focus:outline-none focus:ring-0 flex-1 text-sm`);
  const formAttrs = withClass(attrs||{}, tw`flex items-center gap-2 rounded-[var(--radius)] border border-[var(--input)] bg-[var(--background)] px-3 py-2 shadow-sm`);
  if(gkeySubmit) formAttrs.gkey = gkeySubmit;
  return h.Forms.Form({ attrs: formAttrs }, [
    leading && h.Text.Span({ attrs:{ class: tw`text-lg opacity-60` }}, [leading]),
    h.Inputs.Input({ attrs: inputAttrs }),
    ...(trailing||[])
  ]);
};

UI.EmptyState = ({ icon='✨', title, description, actions=[] })=>
  h.Containers.Div({ attrs:{ class: tw`${token('empty')}` }}, [
    icon && h.Text.Span({ attrs:{ class: tw`text-4xl` }}, [icon]),
    title && h.Text.H3({ attrs:{ class: tw`text-lg font-semibold` }}, [title]),
    description && h.Text.P({ attrs:{ class: tw`${token('muted')} max-w-sm` }}, [description]),
    actions && actions.length ? h.Containers.Div({ attrs:{ class: tw`flex flex-wrap gap-2 justify-center pt-2` }}, actions) : null
  ].filter(Boolean));

UI.List = ({ attrs={}, children=[] })=>
  h.Containers.Div({ attrs: withClass(attrs, token('list')) }, children);

UI.ListItem = ({ leading, content, trailing, attrs={} })=>
  h.Containers.Div({ attrs: withClass(attrs, token('list/item')) }, [
    leading && h.Containers.Div({ attrs:{ class: tw`${token('list/item-leading')}` }}, [leading]),
    h.Containers.Div({ attrs:{ class: tw`${token('list/item-content')}` }}, toChildren(content)),
    trailing && h.Containers.Div({ attrs:{ class: tw`${token('list/item-trailing')}` }}, toChildren(trailing))
  ].filter(Boolean));

function toChildren(node){
  if(node==null) return [];
  return Array.isArray(node)? node: [node];
}

UI.QtyStepper = ({ value=1, gkeyDec, gkeyInc, gkeyEdit, size='sm', dataId })=>
  h.Containers.Div({ attrs:{ class: tw`flex items-center gap-1 bg-[var(--surface-2)] rounded-full px-1 py-1` }}, [
    UI.Button({ attrs:{ gkey:gkeyDec, 'data-line-id':dataId, class: tw`w-8 h-8` }, size }, ['−']),
    h.Forms.Button({ attrs:{ type:'button', gkey:gkeyEdit, 'data-line-id':dataId, class: tw`min-w-[48px] text-center text-sm font-semibold` }}, [String(value)]),
    UI.Button({ attrs:{ gkey:gkeyInc, 'data-line-id':dataId, class: tw`w-8 h-8` }, size }, ['+'])
  ]);

UI.PriceText = ({ amount=0, currency, locale })=>{
  let formatted = amount;
  try {
    const opts = currency ? { style:'currency', currency } : { style:'decimal', minimumFractionDigits:2, maximumFractionDigits:2 };
    formatted = new Intl.NumberFormat(locale || document.documentElement.lang || 'ar', opts).format(Number(amount)||0);
  } catch(_) {
    formatted = (Number(amount)||0).toFixed(2);
    if(currency) formatted += ' ' + currency;
  }
  return h.Text.Span({ attrs:{ class: tw`font-semibold` }}, [formatted]);
};

UI.Segmented = ({ items=[], activeId, attrs={} })=>
  h.Containers.Div({ attrs: withClass(attrs, tw`inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] p-1`) },
    items.map(it=>{
      const active = it.id===activeId;
      const segmentAttrs = Object.assign({ 'data-segment-id': it.id }, it.attrs || {});
      if(!('gkey' in segmentAttrs) && it.gkey){
        segmentAttrs.gkey = it.gkey;
      }
      segmentAttrs.class = tw`${segmentAttrs.class||''} ${active? token('chip/active'): ''}`.trim();
      return UI.Button({
        attrs: segmentAttrs,
        variant: active? 'solid': 'ghost', size:'sm'
      }, [it.label]);
    })
  );

UI.StatCard = ({ title, value, meta, footer })=>
  h.Containers.Div({ attrs:{ class: tw`${token('stat/card')}` }}, [
    title && h.Text.Span({ attrs:{ class: tw`text-sm ${token('muted')}` }}, [title]),
    value && h.Text.Span({ attrs:{ class: tw`${token('stat/value')}` }}, [value]),
    meta && h.Text.Span({ attrs:{ class: tw`text-xs ${token('muted')}` }}, [meta]),
    footer && h.Containers.Div({ attrs:{ class: tw`pt-2 border-t border-dashed border-[var(--border)] mt-2 text-xs flex items-center gap-2` }}, footer)
  ].filter(Boolean));

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

UI.Modal = ({ open=false, title, description, content, actions=[] })=>{
  if(!open) return h.Containers.Div({ attrs:{ class: tw`hidden` }});
  const uid = Math.random().toString(36).slice(2,8);
  const titleId = title ? `modal-${uid}-title` : undefined;
  const descriptionId = description ? `modal-${uid}-desc` : undefined;
  const closeBtn = h.Forms.Button({
    attrs: withClass({
      type:'button',
      gkey:'ui:modal:close',
      'aria-label':'Close dialog'
    }, cx(token('btn'), token('btn/ghost'), token('btn/icon')))
  }, ['✕']);
  const headerContent = [];
  if(title || description){
    headerContent.push(
      h.Containers.Div({ attrs:{ class: tw`space-y-1` }}, [
        title && h.Text.H3({ attrs:{ id:titleId, class: tw`${token('card/title')}` }}, [title]),
        description && h.Text.P({ attrs:{ id:descriptionId, class: tw`${token('card/desc')}` }}, [description])
      ].filter(Boolean))
    );
  } else {
    headerContent.push(h.Containers.Div({ attrs:{ class: tw`flex-1` }}, []));
  }
  headerContent.push(closeBtn);
  const actionNodes = (actions||[]).filter(Boolean);
  const modalAttrs = {
    class: tw`${token('modal-card')}`,
    role:'dialog',
    'aria-modal':'true'
  };
  if(titleId) modalAttrs['aria-labelledby'] = titleId;
  if(descriptionId) modalAttrs['aria-describedby'] = descriptionId;
  return h.Containers.Div({ attrs:{ class: tw`${token('modal-root')}`, role:'presentation' }}, [
    h.Containers.Div({ attrs:{ class: tw`${token('backdrop')}`, gkey:'ui:modal:close' }}),
    h.Containers.Section({ attrs: modalAttrs }, [
      h.Containers.Div({ attrs:{ class: tw`${token('modal/header')}` }}, headerContent.filter(Boolean)),
      content ? h.Containers.Div({ attrs:{ class: tw`${token('modal/body')}` }}, [content]) : null,
      actionNodes.length ? h.Containers.Div({ attrs:{ class: tw`${token('modal/footer')}` }}, actionNodes) : null
    ].filter(Boolean))
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

const NOOP = ()=>{};
const POS_ORDERS = {
  'pos.menu.search':        { on:['input','change'], gkeys:['pos:menu:search'], handler:NOOP },
  'pos.menu.category':      { on:['click'], gkeys:['pos:menu:category'], handler:NOOP },
  'pos.menu.add':           { on:['click'], gkeys:['pos:menu:add'], handler:NOOP },
  'pos.menu.favorite':      { on:['click'], gkeys:['pos:menu:favorite'], handler:NOOP },
  'pos.menu.load-more':     { on:['click'], gkeys:['pos:menu:load-more'], handler:NOOP },

  'pos.order.line.inc':     { on:['click'], gkeys:['pos:order:line:inc'], handler:NOOP },
  'pos.order.line.dec':     { on:['click'], gkeys:['pos:order:line:dec'], handler:NOOP },
  'pos.order.line.qty':     { on:['click'], gkeys:['pos:order:line:qty'], handler:NOOP },
  'pos.order.line.actions': { on:['click'], gkeys:['pos:order:line:actions'], handler:NOOP },
  'pos.order.clear':        { on:['click'], gkeys:['pos:order:clear'], handler:NOOP },
  'pos.order.discount':     { on:['click'], gkeys:['pos:order:discount'], handler:NOOP },
  'pos.order.note':         { on:['click'], gkeys:['pos:order:note'], handler:NOOP },
  'pos.order.save':         { on:['click'], gkeys:['pos:order:save'], handler:NOOP },
  'pos.order.print':        { on:['click'], gkeys:['pos:order:print'], handler:NOOP },

  'pos.tables.open':        { on:['click'], gkeys:['pos:tables:open'], handler:NOOP },
  'pos.tables.select':      { on:['click'], gkeys:['pos:tables:select'], handler:NOOP },
  'pos.tables.merge':       { on:['click'], gkeys:['pos:tables:merge'], handler:NOOP },
  'pos.tables.release':     { on:['click'], gkeys:['pos:tables:release'], handler:NOOP },

  'pos.payments.open':      { on:['click'], gkeys:['pos:payments:open'], handler:NOOP },
  'pos.payments.method':    { on:['click'], gkeys:['pos:payments:method'], handler:NOOP },
  'pos.payments.capture':   { on:['click'], gkeys:['pos:payments:capture'], handler:NOOP },
  'pos.payments.split':     { on:['click'], gkeys:['pos:payments:split'], handler:NOOP },
  'pos.payments.close':     { on:['click'], gkeys:['pos:payments:close'], handler:NOOP },

  'pos.returns.open':       { on:['click'], gkeys:['pos:returns:open'], handler:NOOP },
  'pos.returns.add':        { on:['click'], gkeys:['pos:returns:add'], handler:NOOP },

  'pos.reports.toggle':     { on:['click'], gkeys:['pos:reports:toggle'], handler:NOOP },
  'pos.reports.filter':     { on:['change'], gkeys:['pos:reports:filter'], handler:NOOP },
  'pos.reports.export':     { on:['click'], gkeys:['pos:reports:export'], handler:NOOP },

  'pos.indexeddb.sync':     { on:['click'], gkeys:['pos:indexeddb:sync'], handler:NOOP },
  'pos.indexeddb.flush':    { on:['click'], gkeys:['pos:indexeddb:flush'], handler:NOOP },

  'pos.kds.connect':        { on:['click'], gkeys:['pos:kds:connect'], handler:NOOP },
  'pos.kds.retry':          { on:['click'], gkeys:['pos:kds:retry'], handler:NOOP },
  'pos.kds.preview':        { on:['click'], gkeys:['pos:kds:preview'], handler:NOOP },

  'pos.shift.start':       { on:['click'], gkeys:['pos:shift:start'], handler:NOOP },
  'pos.shift.end':         { on:['click'], gkeys:['pos:shift:end'], handler:NOOP },
  'pos.session.logout':    { on:['click'], gkeys:['pos:session:logout'], handler:NOOP },

  'pos.shortcuts.help':    { on:['click'], gkeys:['pos:shortcuts:help'], handler:NOOP }
};

M.UI = UI;
M.UI.orders = Object.assign({}, ORDERS, POS_ORDERS);
M.UI.posOrders = POS_ORDERS;

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