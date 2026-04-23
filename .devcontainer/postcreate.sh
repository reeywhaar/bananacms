#!/bin/bash

sudo chmod -R 777 node_modules
sudo chmod -R 777 .next
sudo chmod -R 777 build
sudo chmod -R 777 /home_volume

if [ -f ~/.zsh_history ]; then
	cp ~/.zsh_history /home_volume
else
	touch /home_volume/.zsh_history
fi
ln -sf /home_volume/.zsh_history ~/.zsh_history

npm install -g npm@latest

sudo echo "vscode ALL=(ALL) NOPASSWD:ALL" | sudo tee /etc/sudoers.d/vscode
