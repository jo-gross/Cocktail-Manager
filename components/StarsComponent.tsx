import { FaStar, FaStarHalf } from 'react-icons/fa';
import React from 'react';

interface StarsComponentProps {
  rating: number;
}

export default function StarsComponent(props: StarsComponentProps) {
  return (
    <div className={'flex flex-row items-center gap-0.5'}>
      {Array.from({ length: 5 }).map((_, index) => {
        return props.rating - 1 >= index ? (
          <FaStar key={`cocktail-rating-${index}`} className={'text-yellow-500'} />
        ) : props.rating - 1 >= index - 0.5 ? (
          <div className="relative">
            <FaStarHalf key={`cocktail-rating-half-${index}`} className="absolute text-yellow-500" />
            <FaStar key={`cocktail-rating-background-${index}`} className="text-gray-400" />
          </div>
        ) : (
          <FaStar key={`cocktail-rating-${index}`} className={'text-gray-400'} />
        );
      })}
    </div>
  );
}
