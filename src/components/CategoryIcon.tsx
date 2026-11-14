import React from 'react';
import {
  Home,
  Wifi,
  Zap,
  Flame,
  Droplets,
  ShoppingCart,
  Utensils,
  Coffee,
  Pill,
  Stethoscope,
  Bus,
  Car,
  Fuel,
  Smartphone,
  ShoppingBag,
  Users,
  User,
  Briefcase,
  GraduationCap,
  Banknote,
  Landmark,
  Handshake,
  CalendarClock,
  Gift,
  Wrench,
  Shirt,
  Scissors,
  Dumbbell,
  Plane,
  Tv,
  Wallet,
  Tag
} from 'lucide-react';
import {
  DailyIconId,
  getIconMetaById,
  resolveCategoryIconId
} from '../utils/categoryUtils';

const ICON_COMPONENTS: Record<DailyIconId, React.FC<{ className?: string }>> = {
  home_rent: Home,
  wifi: Wifi,
  electricity: Zap,
  gas_cooking: Flame,
  water: Droplets,
  grocery: ShoppingCart,
  food_meal: Utensils,
  tea_coffee: Coffee,
  medicine: Pill,
  doctor_health: Stethoscope,
  transport_bus: Bus,
  car_ride: Car,
  fuel_bike: Fuel,
  mobile: Smartphone,
  shopping: ShoppingBag,
  family: Users,
  personal: User,
  office: Briefcase,
  education: GraduationCap,
  salary: Banknote,
  bank_savings: Landmark,
  borrowed: Handshake,
  arrears: CalendarClock,
  gift: Gift,
  repair: Wrench,
  laundry: Shirt,
  salon: Scissors,
  fitness: Dumbbell,
  travel: Plane,
  entertainment: Tv,
  wallet_cash: Wallet,
  other: Tag
};

interface CategoryIconProps {
  category?: string;
  iconId?: DailyIconId;
  className?: string;
  withBadge?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category = '',
  iconId,
  className = '',
  withBadge = false,
  size = 'md'
}) => {
  const resolvedId = iconId || resolveCategoryIconId(category);
  const meta = getIconMetaById(resolvedId);
  const IconComp = ICON_COMPONENTS[resolvedId] || Tag;

  const sizeClass =
    size === 'xs'
      ? 'w-3.5 h-3.5'
      : size === 'sm'
      ? 'w-4 h-4'
      : size === 'lg'
      ? 'w-6 h-6'
      : 'w-5 h-5';

  if (withBadge) {
    const boxSize =
      size === 'xs'
        ? 'w-6 h-6'
        : size === 'sm'
        ? 'w-8 h-8'
        : size === 'lg'
        ? 'w-12 h-12'
        : 'w-10 h-10';
    return (
      <div
        className={`${boxSize} rounded-full flex items-center justify-center shrink-0 border shadow-xs ${meta.bgClass} ${meta.textClass} ${className}`}
      >
        <IconComp className={sizeClass} />
      </div>
    );
  }

  return <IconComp className={`${sizeClass} ${className}`} />;
};
