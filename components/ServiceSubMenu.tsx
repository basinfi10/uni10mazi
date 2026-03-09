

import React, { useState, useEffect } from 'react';
import { 
  X, Sun, CalendarDays, Clock, Map, Newspaper, Globe2, 
  Soup, CookingPot, Utensils, Salad, Fish, UtensilsCrossed, Wine, Pizza, Croissant, ChefHat, Carrot, Star, 
  Activity, Apple, Dumbbell, Scale, Ruler, Smile, UserCheck, Bone, Pill, Wind, Brain, ShieldPlus, 
  Shirt, Refrigerator, Sparkles, Home, Package, Plane, Bike, HeartHandshake, Sparkle, Smartphone, Siren, Tent, 
  Coffee, Phone, Luggage, Briefcase, Bed, Stethoscope, ShoppingBag, Building2, Ambulance, MapPin, MessageCircle, Hash, AArrowUp, ChevronDown 
} from 'lucide-react';
import { SERVICE_DATA, ServiceItem } from './Service_Prompts';

interface ServiceSubMenuProps {
  activeCategoryId: string | null;
  isLoading: boolean;
  onSelect: (item: ServiceItem) => void;
  onClose: () => void;
  onMinimize?: () => void;
}

const getItemIcon = (id: string) => {
  const size = 24;
  const className = "mb-1 text-gray-400 group-hover:text-emerald-400 transition-colors";
  
  switch(id) {
    // Weather
    case 'curr_weather': return <Sun size={size} className={className} />;
    case 'week_weather': return <CalendarDays size={size} className={className} />;
    case 'hour_weather': return <Clock size={size} className={className} />;
    case 'nat_weather': return <Map size={size} className={className} />;
    case 'major_news': return <Newspaper size={size} className={className} />;
    case 'world_news': return <Globe2 size={size} className={className} />;
    
    // Cooking
    case 'soup_kor': return <Soup size={size} className={className} />;
    case 'stew_kor': return <CookingPot size={size} className={className} />;
    case 'stir_kor': return <Utensils size={size} className={className} />;
    case 'salad_kor': return <Salad size={size} className={className} />;
    case 'japan': return <Fish size={size} className={className} />;
    case 'chinese': return <UtensilsCrossed size={size} className={className} />;
    case 'french': return <Wine size={size} className={className} />;
    case 'italian': return <Pizza size={size} className={className} />;
    case 'baguette': return <Croissant size={size} className={className} />;
    case 'today': return <ChefHat size={size} className={className} />;
    case 'healthy': return <Carrot size={size} className={className} />;
    case 'recommend': return <Star size={size} className={className} />;
    
    // Health
    case 'habit': return <Activity size={size} className={className} />;
    case 'diet_food': return <Apple size={size} className={className} />;
    case 'exercise': return <Dumbbell size={size} className={className} />;
    case 'diet': return <Scale size={size} className={className} />;
    case 'obesity': return <Ruler size={size} className={className} />;
    case 'dental': return <Smile size={size} className={className} />;
    case 'skin': return <UserCheck size={size} className={className} />;
    case 'joint': return <Bone size={size} className={className} />;
    case 'pain': return <Pill size={size} className={className} />;
    case 'env': return <Wind size={size} className={className} />;
    case 'mental': return <Brain size={size} className={className} />;
    case 'immune': return <ShieldPlus size={size} className={className} />;

    // Life
    case 'laundry': return <Shirt size={size} className={className} />;
    case 'kitchen': return <Refrigerator size={size} className={className} />;
    case 'cleaning': return <Sparkles size={size} className={className} />;
    case 'home': return <Home size={size} className={className} />;
    case 'lifeitem': return <Package size={size} className={className} />;
    case 'travel_go': return <Plane size={size} className={className} />;
    case 'health_ex': return <Bike size={size} className={className} />;
    case 'mental_care': return <HeartHandshake size={size} className={className} />;
    case 'beauty': return <Sparkle size={size} className={className} />;
    case 'app': return <Smartphone size={size} className={className} />;
    case 'safety': return <Siren size={size} className={className} />;
    case 'camping': return <Tent size={size} className={className} />;

    // English & Japanese
    case 'cafe': 
    case 'cafe_jp': return <Coffee size={size} className={className} />;
    case 'phone': 
    case 'phone_jp': return <Phone size={size} className={className} />;
    case 'travel': 
    case 'travel_jp': return <Luggage size={size} className={className} />;
    case 'work': 
    case 'work_jp': return <Briefcase size={size} className={className} />;
    case 'hotel': 
    case 'hotel_jp': return <Bed size={size} className={className} />;
    case 'airport': 
    case 'airport_jp': return <Plane size={size} className={className} />;
    case 'hospital': 
    case 'hospital_jp': return <Stethoscope size={size} className={className} />;
    case 'restaurant': 
    case 'restaurant_jp': return <Utensils size={size} className={className} />;
    case 'shopping': 
    case 'shopping_jp': return <ShoppingBag size={size} className={className} />;
    case 'business': 
    case 'business_jp': return <Building2 size={size} className={className} />;
    case 'emergency': 
    case 'emergency_jp': return <Ambulance size={size} className={className} />;
    case 'street': 
    case 'street_jp': return <MapPin size={size} className={className} />;
    case 'chatter': 
    case 'chatter_jp': return <MessageCircle size={size} className={className} />;
    case 'topic': 
    case 'topic_jp': return <Hash size={size} className={className} />;
    case 'general': 
    case 'general_jp': return <Globe2 size={size} className={className} />;
    case 'beg_word': 
    case 'int_word':
    case 'adv_word':
    case 'beg_word_jp': 
    case 'int_word_jp':
    case 'adv_word_jp': return <AArrowUp size={size} className={className} />;
    
    default: return <Sparkles size={size} className={className} />;
  }
}

const ServiceSubMenu: React.FC<ServiceSubMenuProps> = React.memo(({ 
  activeCategoryId, 
  isLoading, 
  onSelect, 
  onClose,
  onMinimize
}) => {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Reset selection when category changes
  useEffect(() => {
    setSelectedItemId(null);
  }, [activeCategoryId]);

  const category = SERVICE_DATA.find(c => c.id === activeCategoryId);

  if (!category) return null;

  const handleItemClick = (item: ServiceItem) => {
    setSelectedItemId(item.id);
    onSelect(item);
  };

  return (
    <div className="border-t border-gray-800 bg-[#1e1e1e]/95 backdrop-blur-sm animate-in slide-in-from-bottom-5 fade-in duration-300 relative z-20">
      {/* Minimize Button (Fold) */}
      <button 
        onClick={onMinimize || onClose}
        className="absolute top-1 right-1 p-1 text-gray-500 hover:text-white rounded-full hover:bg-gray-700 transition-colors z-30"
        title="메뉴 접기"
      >
        <ChevronDown size={16} />
      </button>

      {/* Grid Layout: 6 columns. Flex column for icon+text */}
      <div className="grid grid-cols-6 gap-2 p-2 pt-6 max-w-4xl mx-auto">
        {category.items.map((item) => {
          const isSelected = selectedItemId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              disabled={isLoading}
              className={`
                group flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all
                disabled:opacity-50 disabled:cursor-not-allowed
                ${isSelected 
                  ? 'bg-emerald-900/30 border border-emerald-500/50' 
                  : 'bg-[#252525] border border-transparent hover:bg-gray-800 hover:border-gray-700'
                }
              `}
            >
              <div className={isSelected ? "text-emerald-400" : ""}>
                {getItemIcon(item.id)}
              </div>
              <span className={`text-[11px] leading-tight text-center break-words w-full truncate mt-1 ${isSelected ? 'text-emerald-300 font-semibold' : 'text-gray-300 group-hover:text-gray-100'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

export default ServiceSubMenu;
