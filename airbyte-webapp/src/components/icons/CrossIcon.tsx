interface CrossIconProps {
  color?: string;
  title?: string;
}

export const CrossIcon = ({ color = "currentColor", title }: CrossIconProps) => (
  <svg width="20" height="20" viewBox="0 0 10 10" fill="none" role="img" data-icon="cross">
    {title && <title>{title}</title>}
    <path
      d="M9.20495 0.71967C8.91206 0.426777 8.43718 0.426777 8.14429 0.71967L4.96234 3.90162L1.7804 0.719679C1.48751 0.426786 1.01263 0.426786 0.71974 0.719679C0.426847 1.01257 0.426847 1.48745 0.71974 1.78034L3.90168 4.96228L0.71967 8.14429C0.426777 8.43718 0.426777 8.91206 0.71967 9.20495C1.01256 9.49784 1.48744 9.49784 1.78033 9.20495L4.96234 6.02294L8.14436 9.20496C8.43725 9.49785 8.91213 9.49785 9.20502 9.20496C9.49791 8.91207 9.49791 8.43719 9.20502 8.1443L6.023 4.96228L9.20495 1.78033C9.49784 1.48744 9.49784 1.01256 9.20495 0.71967Z"
      fill={color}
    />
  </svg>
);
