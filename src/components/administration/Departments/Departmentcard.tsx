import {
    TrendingUp, Package, Layers, Clock, Edit2, Trash2,
    Printer, Users2, Map, Monitor, Zap, EyeOff, Activity,
} from 'lucide-react';
import { OrderStatus } from '../../../../types';
import type { Department, MenuItem, Order, Employee } from "../../../../types"
import StatusBadge from "./ui/Statusbadge";
import IconButton from './ui/Iconbutton';

interface DepartmentCardProps {
    dept: Department;
    menuItems: MenuItem[];
    activeOrders: Order[];
    employees: Employee[];
    onEdit: (dept: Department) => void;
    onDelete: (id: string | number) => void;
}

const DepartmentCard = ({
    dept,
    menuItems = [],
    activeOrders = [],
    employees = [],
    onEdit,
    onDelete,
}: DepartmentCardProps) => {
    const deptId = String(dept.id);
    const deptItems = menuItems.filter(item => String(item.departmentId) === deptId);
    const activeDeptOrders = activeOrders.filter(
        o => o.items.some(i => String(i.departmentId) === deptId) && o.status !== OrderStatus.COMPLETED
    );
    const deptEmployees = employees.filter(e => String(e.departmentId) === deptId);
    const capacity = dept.maxConcurrentOrders || 10;
    const capacityRatio = activeDeptOrders.length / capacity;

    return (
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 hover:border-red-500/30 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1.5 h-full" style={{ backgroundColor: dept.color || '#ef4444' }} />
            <CardHeader dept={dept} onEdit={onEdit} onDelete={onDelete} />
            <CardStats dept={dept} />
            <CardMetrics
                deptItems={deptItems}
                activeDeptOrders={activeDeptOrders}
                deptEmployees={deptEmployees}
                capacity={capacity}
                capacityRatio={capacityRatio}
            />
            <CardFooter dept={dept} />
        </div>
    );
};

const CardHeader = ({
    dept, onEdit, onDelete,
}: {
    dept: Department;
    onEdit: (d: Department) => void;
    onDelete: (id: string | number) => void;
}) => (
    <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
            <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform shadow-inner"
                style={{ backgroundColor: `${dept.color || '#ef4444'}15`, color: dept.color || '#ef4444' }}
            >
                {dept.icon || <Layers size={24} />}
            </div>
            <div>
                <h3 className="text-xl font-bold text-white">{dept.nameAr || dept.name}</h3>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {dept.shortName || String(dept.id).slice(0, 3).toUpperCase()}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-slate-700" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{dept.type}</span>
                </div>
            </div>
        </div>
        <div className="flex items-center gap-1">
            <IconButton onClick={() => onEdit(dept)} title="تعديل"><Edit2 size={16} /></IconButton>
            <IconButton onClick={() => onDelete(dept.id)} variant="danger" title="حذف"><Trash2 size={16} /></IconButton>
        </div>
    </div>
);

const CardStats = ({ dept }: { dept: Department }) => (
    <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5">
            <p className="text-[10px] text-slate-500 mb-1">الموقع / المحطة</p>
            <div className="flex items-center gap-2">
                <Map size={14} className="text-red-500" />
                <span className="text-sm font-bold text-white">{dept.location || `Station ${dept.stationNumber || '?'}`}</span>
            </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5">
            <p className="text-[10px] text-slate-500 mb-1">وقت التحضير</p>
            <div className="flex items-center gap-2">
                <Clock size={14} className="text-emerald-500" />
                <span className="text-sm font-bold text-white">{dept.defaultPrepTime || 0} دقيقة</span>
            </div>
        </div>
    </div>
);

const CardMetrics = ({
    deptItems, activeDeptOrders, deptEmployees, capacity, capacityRatio,
}: {
    deptItems: MenuItem[];
    activeDeptOrders: Order[];
    deptEmployees: Employee[];
    capacity: number;
    capacityRatio: number;
}) => (
    <div className="space-y-3">
        <MetricRow icon={<Package size={12} />} label="الأصناف" value={`${deptItems.length} صنف`} valueClass="text-white" />
        <MetricRow icon={<Activity size={12} />} label="طلبات نشطة" value={`${activeDeptOrders.length} طلب`} valueClass="text-blue-500" />
        <MetricRow icon={<Users2 size={12} />} label="الموظفين" value={`${deptEmployees.length} موظف`} valueClass="text-white" />
        <MetricRow icon={<TrendingUp size={12} />} label="الأكثر مبيعاً" value="—" valueClass="text-emerald-500" />
        <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 flex items-center gap-1">
                <Zap size={12} />
                الطاقة الاستيعابية
            </span>
            <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all ${capacityRatio > 0.8 ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, capacityRatio * 100)}%` }}
                    />
                </div>
                <span className="text-[10px] text-slate-400">{activeDeptOrders.length}/{capacity}</span>
            </div>
        </div>
    </div>
);

const MetricRow = ({
    icon, label, value, valueClass,
}: { icon: React.ReactNode; label: string; value: string; valueClass: string }) => (
    <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 flex items-center gap-1">{icon}{label}</span>
        <span className={`font-bold ${valueClass}`}>{value}</span>
    </div>
);

const CardFooter = ({ dept }: { dept: Department }) => (
    <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2">
            {dept.hasKds ? (
                <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-1 rounded-lg">
                    <Monitor size={10} />
                    KDS نشط
                </div>
            ) : (
                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold bg-slate-500/10 px-2 py-1 rounded-lg">
                    <EyeOff size={10} />
                    بدون شاشة
                </div>
            )}
            {dept.autoPrintTicket && (
                <div className="p-1 bg-blue-500/10 text-blue-500 rounded-lg" title="طباعة تلقائية">
                    <Printer size={12} />
                </div>
            )}
        </div>
        <StatusBadge status={dept.status} />
    </div>
);

export default DepartmentCard;
