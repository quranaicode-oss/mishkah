
// mishkah-Diagnostics.js
(function (window) {
  "use strict";
  
    const M = window.Mishkah || (window.Mishkah = {});

function runPOSDiagnostics() {
  console.clear();
  console.log("%c🏪 بدء تشخيص تطبيق POS الشامل 🏪", "color: #dc2626; font-size: 1.4em; font-weight: bold; background: #fef2f2; padding: 8px; border-radius: 4px;");
  
  let diagnosticResults = {
    phase1: false,
    phase2: false, 
    phase3: false,
    phase4: false,
    phase5: false
  };

  // --- المرحلة 1: فحص البيئة الأساسية ---
  console.log("\n%c=== المرحلة 1: فحص البيئة الأساسية ===", "color: #059669; font-weight: bold; font-size: 1.1em;");
  
  const coreChecks = {
    mishkahCore: !!window.Mishkah,
    mishkahAtoms: !!(window.Mishkah?.Atoms),
    mishkahCore_createApp: !!(window.Mishkah?.Core?.createApp),
    mockDatabase: !!window.database,
    posComponents: !!window.POSC,
    appInstance: !!window.app,
    htmlRoot: !!document.querySelector('#app')
  };

  let phase1Success = true;
  for (const [key, value] of Object.entries(coreChecks)) {
    const status = value ? '✅' : '❌';
    const color = value ? 'color: #16a34a' : 'color: #dc2626';
    console.log(`%c${status} ${key.padEnd(20, ' ')}: ${value ? 'متوفر' : 'مفقود'}`, color);
    if (!value) phase1Success = false;
  }
  
  diagnosticResults.phase1 = phase1Success;
  if (!phase1Success) {
    console.error("%c⛔ توقف التشخيص: البيئة الأساسية غير مكتملة!", "color: #dc2626; font-weight: bold; background: #fee2e2; padding: 4px;");
    return diagnosticResults;
  }

  // --- المرحلة 2: فحص البيانات الأولية ---
  console.log("\n%c=== المرحلة 2: فحص البيانات الأولية ===", "color: #059669; font-weight: bold; font-size: 1.1em;");
  
  const dataChecks = {
    categories: (window.database?.categories || []).length,
    items: (window.database?.items || []).length,
    employees: (window.database?.employees || []).length,
    tables: (window.database?.tables || []).length
  };

  let phase2Success = true;
  for (const [key, count] of Object.entries(dataChecks)) {
    const hasData = count > 0;
    const status = hasData ? '✅' : '⚠️';
    const color = hasData ? 'color: #16a34a' : 'color: #f59e0b';
    console.log(`%c${status} ${key.padEnd(15, ' ')}: ${count} عنصر`, color);
    if (!hasData && key === 'categories') phase2Success = false;
  }
  
  diagnosticResults.phase2 = phase2Success;

  // --- المرحلة 3: فحص مكونات POSC ---
  console.log("\n%c=== المرحلة 3: فحص مكونات POSC ===", "color: #059669; font-weight: bold; font-size: 1.1em;");
  
  const poscComponents = ['header', 'menu', 'order', 'modals'];
  let phase3Success = true;
  
  for (const comp of poscComponents) {
    const fn = window.POSC?.[comp];
    const isFunction = typeof fn === 'function';
    const status = isFunction ? '✅' : '❌';
    const color = isFunction ? 'color: #16a34a' : 'color: #dc2626';
    console.log(`%c${status} POSC.${comp.padEnd(10, ' ')}: ${isFunction ? 'دالة صحيحة' : 'مفقودة أو خاطئة'}`, color);
    if (!isFunction) phase3Success = false;
  }
  
  diagnosticResults.phase3 = phase3Success;

  // --- المرحلة 4: فحص تطبيق Mishkah ---
  console.log("\n%c=== المرحلة 4: فحص تطبيق Mishkah ===", "color: #059669; font-weight: bold; font-size: 1.1em;");
  
  try {
    const app = window.app;
    const truth = app?.truth;
    const state = truth?.get();
    
    console.log("%c✅ التطبيق موجود:", "color: #16a34a", app ? 'نعم' : 'لا');
    console.log("%c✅ Truth store موجود:", "color: #16a34a", truth ? 'نعم' : 'لا');
    console.log("%c✅ State متوفر:", "color: #16a34a", state ? 'نعم' : 'لا');
    
    if (state) {
      console.log("📊 محتويات State الحالية:");
      console.log("   - settings:", !!state.settings);
      console.log("   - catalog:", !!state.catalog);
      console.log("   - employees:", Array.isArray(state.employees) ? `${state.employees.length} موظف` : 'غير محدد');
      console.log("   - session:", !!state.session);
      console.log("   - order:", !!state.order);
      console.log("   - ui:", !!state.ui);
    }
    
    diagnosticResults.phase4 = !!(app && truth && state);
  } catch (error) {
    console.error("%c❌ خطأ في فحص التطبيق:", "color: #dc2626", error);
    diagnosticResults.phase4 = false;
  }

  // --- المرحلة 5: محاكاة بناء المكونات ---
  console.log("\n%c=== المرحلة 5: محاكاة بناء المكونات ===", "color: #059669; font-weight: bold; font-size: 1.1em;");
  
  let phase5Success = true;
  const state = window.app?.truth?.get();
  
  for (const compName of poscComponents) {
    try {
      console.log(`\n🔧 اختبار مكون: ${compName}`);
      
      const fn = window.POSC[compName];
      if (typeof fn !== 'function') {
        throw new Error(`${compName} ليس دالة`);
      }
      
      console.log(`   ✅ الدالة متوفرة`);
      
      const result = fn(state);
      console.log(`   ✅ تم تنفيذ الدالة`);
      console.log(`   📦 نوع النتيجة:`, typeof result);
      
      if (result && typeof result === 'object' && result.__A) {
        console.log(`   ✅ النتيجة كائن Atoms صحيح`);
        
        // محاولة تحويل إلى DOM
        const domNode = window.Mishkah.Atoms.toNode(result);
        if (domNode instanceof Node) {
          console.log(`   ✅ تم تحويل إلى DOM بنجاح`);
          console.log(`   🏷️ نوع العقدة:`, domNode.constructor.name);
        } else {
          throw new Error('فشل تحويل إلى DOM');
        }
      } else {
        throw new Error('النتيجة ليست كائن Atoms صحيح');
      }
      
      console.log(`   %c🎉 ${compName} يعمل بنجاح!`, "color: #16a34a; font-weight: bold");
      
    } catch (error) {
      console.error(`   %c💥 فشل ${compName}:`, "color: #dc2626; font-weight: bold", error.message);
      console.error(`   📍 التفاصيل:`, error);
      phase5Success = false;
    }
  }
  
  diagnosticResults.phase5 = phase5Success;

  // --- النتيجة النهائية ---
  console.log("\n%c📋 ملخص التشخيص النهائي 📋", "color: #1e40af; font-size: 1.3em; font-weight: bold; background: #eff6ff; padding: 8px; border-radius: 4px;");
  
  for (const [phase, success] of Object.entries(diagnosticResults)) {
    const status = success ? '✅' : '❌';
    const color = success ? 'color: #16a34a' : 'color: #dc2626';
    console.log(`%c${status} ${phase}: ${success ? 'نجح' : 'فشل'}`, color);
  }
  
  const allSuccess = Object.values(diagnosticResults).every(Boolean);
  
  if (allSuccess) {
    console.log("\n%c🎊 جميع المراحل نجحت! التطبيق يجب أن يعمل الآن. 🎊", "color: #16a34a; font-size: 1.2em; font-weight: bold; background: #f0fdf4; padding: 8px; border-radius: 4px;");
    console.log("\n%c💡 إذا كانت الشاشة لا تزال فارغة، تحقق من:", "color: #f59e0b; font-weight: bold;");
    console.log("   1. هل تم تشغيل app.dispatch('boot')؟");
    console.log("   2. هل تم تسجيل المناطق بشكل صحيح؟");
    console.log("   3. هل هناك أخطاء JavaScript في الكونسول؟");
  } else {
    console.log("\n%c🚨 التشخيص يشير إلى مشاكل في التطبيق! 🚨", "color: #dc2626; font-size: 1.2em; font-weight: bold; background: #fef2f2; padding: 8px; border-radius: 4px;");
    console.log("راجع المراحل التي فشلت أعلاه لحل المشكلة.");
  }
  
  return diagnosticResults;
}

// وظيفة تشخيص مبسطة للاستدعاء السريع
function quickPOSCheck() {
  console.log("%c🔍 فحص سريع لـ POS", "color: #2563eb; font-weight: bold;");
  
  const issues = [];
  
  if (!window.Mishkah) issues.push("❌ Mishkah Core مفقود");
  if (!window.database) issues.push("❌ Mock data مفقود");  
  if (!window.POSC) issues.push("❌ POSC components مفقود");
  if (!window.app) issues.push("❌ App instance مفقود");
  if (!document.querySelector('#app')) issues.push("❌ HTML root مفقود");
  
  if (issues.length === 0) {
    console.log("✅ جميع المكونات الأساسية موجودة");
    console.log("💡 شغل runPOSDiagnostics() للفحص التفصيلي");
  } else {
    console.log("⚠️ مشاكل تم العثور عليها:");
    issues.forEach(issue => console.log(`   ${issue}`));
  }
}

// إضافة للـ window global
M.runPOSDiagnostics = runPOSDiagnostics;
M.quickPOSCheck = quickPOSCheck;


})(window);
