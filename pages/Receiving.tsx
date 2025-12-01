
import React, { useState, useEffect } from 'react';
import { Truck, Scale, AlertTriangle, CheckCircle2, Save, Bell, ArrowRight, RefreshCw } from 'lucide-react';
import { createBatch, clearHarvestAlert, checkHarvestAlerts } from '../services/sheetService';

interface ReceivingPageProps {
  prefillData?: any; // Kept for compatibility but we mostly use internal fetching
  onClear?: () => void;
}

const ReceivingPage: React.FC<ReceivingPageProps> = ({ prefillData, onClear }) => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    sourceFarm: '',
    rawWeight: '',
    spoiledWeight: '0'
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);

  // Poll for alerts directly here to show the list
  useEffect(() => {
     const fetchAlerts = async () => {
         setIsLoadingAlerts(true);
         const res = await checkHarvestAlerts();
         if (res.success && Array.isArray(res.data)) {
             setAlerts(res.data);
         }
         setIsLoadingAlerts(false);
     };
     fetchAlerts();
     const interval = setInterval(fetchAlerts, 10000); // Poll every 10s
     return () => clearInterval(interval);
  }, []);

  // Handle props if passed from dashboard (legacy support)
  useEffect(() => {
    if (prefillData) {
        handlePreFill(prefillData);
    }
  }, [prefillData]);

  const handlePreFill = (alertData: any) => {
      setFormData({
          sourceFarm: alertData.farmName || '',
          rawWeight: String(alertData.estimatedWeightKg || ''),
          spoiledWeight: '0'
      });
      setActiveAlertId(alertData.id);
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const netWeight = (parseFloat(formData.rawWeight) || 0) - (parseFloat(formData.spoiledWeight) || 0);
  const isSpoiledDetected = (parseFloat(formData.spoiledWeight) || 0) > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sourceFarm || !formData.rawWeight) return;

    setStatus('submitting');
    const result = await createBatch(
      formData.sourceFarm, 
      parseFloat(formData.rawWeight), 
      parseFloat(formData.spoiledWeight)
    );

    if (result.success) {
      // Clear the specific alert if we are processing one
      if (activeAlertId) {
          await clearHarvestAlert(activeAlertId);
          // Remove from local list immediately for UI responsiveness
          setAlerts(prev => prev.filter(a => a.id !== activeAlertId));
          setActiveAlertId(null);
      }
      if (onClear) onClear(); 

      setStatus('success');
      setFormData({ sourceFarm: '', rawWeight: '', spoiledWeight: '0' });
      setTimeout(() => setStatus('idle'), 3000);
    } else {
      setStatus('error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <div className="p-3 bg-earth-100 rounded-xl text-earth-700">
          <Truck size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Receiving Log</h2>
          <p className="text-slate-500">Log incoming mushroom batches from farms</p>
        </div>
      </div>

      {/* INCOMING SHIPMENTS LIST */}
      <div className="space-y-3">
         <div className="flex items-center justify-between text-sm font-bold text-slate-500 uppercase tracking-wider">
             <span>Incoming Shipments ({alerts.length})</span>
             {isLoadingAlerts && <RefreshCw size={14} className="animate-spin text-slate-400" />}
         </div>
         
         {alerts.length > 0 ? (
             <div className="space-y-3 animate-in slide-in-from-top duration-500">
                 {alerts.map(alert => (
                     <div key={alert.id} className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center shadow-sm">
                         <div className="flex items-start space-x-4 mb-4 md:mb-0">
                             <div className="p-3 bg-white rounded-lg text-orange-600 shadow-sm">
                                 <Bell size={24} />
                             </div>
                             <div>
                                 <h4 className="font-bold text-orange-900 text-lg">Incoming Shipment Alert</h4>
                                 <div className="text-orange-800 text-sm space-y-1 mt-1">
                                     <p className="font-semibold">{alert.farmName} <span className="mx-2 text-orange-300">•</span> Est. {alert.estimatedWeightKg} kg</p>
                                     <p className="text-orange-700 flex items-center"><span className="opacity-75 mr-2">🌱</span> {alert.species}</p>
                                     <p className="text-xs text-orange-600 opacity-75 mt-1">Sent: {new Date(alert.timestamp).toLocaleTimeString()}</p>
                                 </div>
                             </div>
                         </div>
                         <button 
                            onClick={() => handlePreFill(alert)}
                            className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg shadow-md transition-all flex items-center whitespace-nowrap"
                         >
                            Accept & Pre-fill <ArrowRight size={18} className="ml-2" />
                         </button>
                     </div>
                 ))}
             </div>
         ) : (
             <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-6 text-center text-slate-400">
                 <p>No new shipment alerts found.</p>
                 <p className="text-xs mt-1">System is checking for "RECEIVED_AT_PROCESSING" status.</p>
             </div>
         )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-2">
             <h3 className="font-bold text-slate-800">New Batch Entry</h3>
             {activeAlertId && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold">Linked to Alert</span>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Source Farm</label>
            <select
              value={formData.sourceFarm}
              onChange={(e) => setFormData({...formData, sourceFarm: e.target.value})}
              className="w-full rounded-lg border-slate-300 border p-3 focus:ring-2 focus:ring-nature-500 focus:border-nature-500 outline-none bg-white"
              required
            >
              <option value="">Select a Farm...</option>
              <option value="Green Valley Farms">Green Valley Farms</option>
              <option value="Hilltop Myco">Hilltop Myco</option>
              <option value="Forest Floor Organics">Forest Floor Organics</option>
              
              {/* Dynamically add option if alert has a new farm name */}
              {formData.sourceFarm && !['Green Valley Farms', 'Hilltop Myco', 'Forest Floor Organics'].includes(formData.sourceFarm) && (
                  <option value={formData.sourceFarm}>{formData.sourceFarm}</option>
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Total Weight (kg)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.rawWeight}
                  onChange={(e) => setFormData({...formData, rawWeight: e.target.value})}
                  className="w-full rounded-lg border-slate-300 border p-3 pl-10 focus:ring-2 focus:ring-nature-500 focus:border-nature-500 outline-none"
                  placeholder="0.00"
                  required
                />
                <Scale className="absolute left-3 top-3.5 text-slate-400" size={18} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Spoiled Weight (kg)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.spoiledWeight}
                  onChange={(e) => setFormData({...formData, spoiledWeight: e.target.value})}
                  className="w-full rounded-lg border-slate-300 border p-3 pl-10 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                  placeholder="0.00"
                />
                <AlertTriangle className="absolute left-3 top-3.5 text-slate-400" size={18} />
              </div>
            </div>
          </div>

          {/* Visualization of Net Weight */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex justify-between items-end">
              <span className="text-slate-500 font-medium">Net Usable Weight</span>
              <span className="text-3xl font-bold text-nature-700">{netWeight.toFixed(2)} <span className="text-base text-slate-400 font-normal">kg</span></span>
            </div>
            {isSpoiledDetected && (
              <div className="mt-2 text-xs text-red-600 flex items-center">
                <AlertTriangle size={12} className="mr-1" />
                {((parseFloat(formData.spoiledWeight) / parseFloat(formData.rawWeight)) * 100).toFixed(1)}% spoilage detected
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={status === 'submitting'}
            className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center transition-all ${
              status === 'submitting' 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                : 'bg-earth-800 hover:bg-earth-900 text-white shadow-lg hover:shadow-xl'
            }`}
          >
            {status === 'submitting' ? (
              'Processing...'
            ) : status === 'success' ? (
              <span className="flex items-center"><CheckCircle2 className="mr-2" /> Logged Successfully</span>
            ) : (
              <span className="flex items-center"><Save className="mr-2" /> Log Delivery</span>
            )}
          </button>
        </form>

        <div className="hidden lg:block bg-earth-50 rounded-2xl p-6 border border-earth-100 h-fit">
          <h3 className="font-semibold text-earth-800 mb-4">Reception Protocols</h3>
          <ul className="space-y-4 text-sm text-earth-700">
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white border border-earth-200 text-earth-600 flex items-center justify-center mr-3 font-bold text-xs">1</span>
              Verify delivery truck seal and documentation match.
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white border border-earth-200 text-earth-600 flex items-center justify-center mr-3 font-bold text-xs">2</span>
              Perform gross weight check on platform scale.
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white border border-earth-200 text-earth-600 flex items-center justify-center mr-3 font-bold text-xs">3</span>
              Manually sort random sample for spoilage. If &gt;5% spoilage, flag for manager review.
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white border border-earth-200 text-earth-600 flex items-center justify-center mr-3 font-bold text-xs">4</span>
              Input net values here. Data syncs to Master Log automatically.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ReceivingPage;
