
import React, { useEffect, useState } from 'react';
import { fetchBatches, getFinishedGoods } from '../services/sheetService';
import { MushroomBatch, BatchStatus, FinishedGood } from '../types';
import { Truck, Droplets, Package, TrendingUp, ArrowRight, Activity } from 'lucide-react';

const OverviewPage: React.FC = () => {
  const [batches, setBatches] = useState<MushroomBatch[]>([]);
  const [finishedGoods, setFinishedGoods] = useState<FinishedGood[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const [batchRes, goodsRes] = await Promise.all([fetchBatches(), getFinishedGoods()]);
      if (batchRes.success && batchRes.data) {
        setBatches(batchRes.data);
      }
      if (goodsRes.success && goodsRes.data) {
        setFinishedGoods(goodsRes.data);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  // Calculate Metrics
  const receivedCount = batches.filter(b => b.status === BatchStatus.RECEIVED).length;
  const processingCount = batches.filter(b => b.status === BatchStatus.PROCESSING).length;
  const readyToPackCount = batches.filter(b => b.status === BatchStatus.DRYING_COMPLETE).length;
  
  // Update: Count actual finished units available in stock
  const finishedCount = finishedGoods.reduce((acc, item) => acc + item.quantity, 0);
  
  const totalWeight = batches.reduce((acc, b) => acc + b.netWeightKg, 0);

  const ProcessCard = ({ title, count, icon: Icon, color, desc, suffix }: any) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center relative overflow-hidden group hover:shadow-md transition-all">
      <div className={`p-4 rounded-full ${color} bg-opacity-10 mb-3 group-hover:scale-110 transition-transform duration-300`}>
        <Icon size={28} className={color.replace('bg-', 'text-')} />
      </div>
      <h3 className="text-lg font-bold text-slate-800">{title}</h3>
      <div className="text-4xl font-bold text-slate-900 my-2">{count} {suffix && <span className="text-sm text-slate-400 font-normal">{suffix}</span>}</div>
      <p className="text-xs text-slate-500">{desc}</p>
    </div>
  );

  const ArrowDivider = () => (
    <div className="hidden md:flex items-center justify-center text-slate-300">
      <ArrowRight size={24} />
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-earth-900">Operations Overview</h2>
        <p className="text-earth-600">Live production pipeline monitoring</p>
      </div>

      {/* Process Pipeline Visual */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-4 items-center">
        <ProcessCard 
          title="Receiving" 
          count={receivedCount} 
          icon={Truck} 
          color="bg-blue-500 text-blue-600"
          desc="Batches waiting for wash"
          suffix="Batches"
        />
        <ArrowDivider />
        <ProcessCard 
          title="Processing" 
          count={processingCount} 
          icon={Droplets} 
          color="bg-orange-500 text-orange-600"
          desc="Currently washing/drying"
          suffix="Batches"
        />
        <ArrowDivider />
        <ProcessCard 
          title="Packing" 
          count={readyToPackCount} 
          icon={Package} 
          color="bg-purple-500 text-purple-600"
          desc="Dried & ready to label"
          suffix="Batches"
        />
        <ArrowDivider />
        <ProcessCard 
          title="Finished Stock" 
          count={finishedCount} 
          icon={TrendingUp} 
          color="bg-green-500 text-green-600"
          desc="Units ready for sale"
          suffix="Units"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity Feed */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-800 flex items-center">
              <Activity size={20} className="mr-2 text-nature-600" />
              Recent Batch Activity
            </h3>
            <span className="text-xs font-medium text-slate-400">Live Updates</span>
          </div>
          
          <div className="space-y-4">
            {loading ? (
              <p className="text-slate-400 text-center py-4">Syncing with Master Log...</p>
            ) : batches.slice(0, 5).map((batch) => (
              <div key={batch.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors border-b border-slate-50 last:border-0">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${
                    batch.status === BatchStatus.RECEIVED ? 'bg-blue-500' :
                    batch.status === BatchStatus.PROCESSING ? 'bg-orange-500' :
                    batch.status === BatchStatus.DRYING_COMPLETE ? 'bg-purple-500' :
                    'bg-green-500'
                  }`} />
                  <div>
                    <p className="font-medium text-slate-700 text-sm">{batch.id} - {batch.sourceFarm}</p>
                    <p className="text-xs text-slate-400">{new Date(batch.dateReceived).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold px-2 py-1 bg-slate-100 rounded text-slate-600">
                    {batch.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="bg-earth-800 rounded-2xl p-6 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-earth-200 font-medium mb-1">Total Net Weight Processed</h3>
            <div className="text-4xl font-bold mb-4">{totalWeight.toFixed(1)} <span className="text-lg text-earth-400">kg</span></div>
            
            <div className="mt-8 space-y-2">
              <div className="flex justify-between text-sm text-earth-300">
                <span>System Health</span>
                <span>100%</span>
              </div>
              <div className="w-full bg-earth-700 rounded-full h-1.5">
                <div className="bg-nature-400 h-1.5 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-earth-700">
              <p className="text-xs text-earth-400 leading-relaxed">
                Data is automatically synced to the Master Google Sheet. 
                Manage detailed workflows using the sidebar navigation.
              </p>
            </div>
          </div>
          
          {/* Decorative background element */}
          <div className="absolute -bottom-10 -right-10 text-earth-700 opacity-20">
            <TrendingUp size={150} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewPage;
