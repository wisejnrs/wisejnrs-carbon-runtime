# --- Only run in interactive shells ---
[[ $- != *i* ]] && return 0

# --- History & shell quality of life ---
export HISTCONTROL=ignoreboth                     # ignoredups+ignorespace
export HISTSIZE=100000
export HISTFILESIZE=200000
export HISTTIMEFORMAT='%F %T  '
shopt -s histappend checkwinsize cdspell          # append, size, fix typos in cd
# shopt -s autocd                                 # uncomment to "auto-cd" into dirs

# Make less handle color and avoid writing history file
export LESS='-R'
export LESSHISTFILE=-

# lesspipe (preprocess non-text)
[[ -x /usr/bin/lesspipe ]] && eval "$(SHELL=/bin/sh lesspipe)"

# chroot name, if any
if [[ -z "$debian_chroot" && -r /etc/debian_chroot ]]; then
  debian_chroot=$(< /etc/debian_chroot)
fi

# --- Prompt ---
# Keep debian_chroot and friendly colors; also set xterm title
color_prompt=
if command -v tput >/dev/null && tput setaf 1 >/dev/null 2>&1; then
  color_prompt=yes
fi

if [[ $color_prompt == yes ]]; then
  PS1='${debian_chroot:+($debian_chroot)}\[\e[0;36m\]\u\[\e[0m\]@\[\e[0;33m\]\h\[\e[0m\]:\[\e[0;35m\]\w\[\e[0m\]\$ '
else
  PS1='${debian_chroot:+($debian_chroot)}\u@\h:\w\$ '
fi
case "$TERM" in
  xterm*|rxvt*) PS1="\[\e]0;${debian_chroot:+($debian_chroot)}\u@\h: \w\a\]$PS1" ;;
esac
unset color_prompt

# --- Colors (kept, optional) ---
BLACK='\e[0;30m';  BLUE='\e[0;34m';   GREEN='\e[0;32m';   CYAN='\e[0;36m';   RED='\e[0;31m'
PURPLE='\e[0;35m'; BROWN='\e[0;33m';  LIGHTGRAY='\e[0;37m'
DARKGRAY='\e[1;30m'; LIGHTBLUE='\e[1;34m'; LIGHTGREEN='\e[1;32m'; LIGHTCYAN='\e[1;36m'
LIGHTRED='\e[1;31m'; LIGHTPURPLE='\e[1;35m'; YELLOW='\e[1;33m'; WHITE='\e[1;37m'
NC='\e[0m'

# --- ls / grep colors ---
if command -v dircolors >/dev/null; then
  eval "$(dircolors -b)"
  alias ls='ls --color=auto'
  alias dir='dir --color=auto'
  alias vdir='vdir --color=auto'
  alias grep='grep --color=auto'
  alias fgrep='fgrep --color=auto'
  alias egrep='egrep --color=auto'
fi

# --- Bash completion ---
[[ -f /etc/bash_completion ]] && . /etc/bash_completion

######################
# CUSTOM STARTS HERE #
######################

###########
# Aliases #
###########

# ls
alias ll='ls -l'
alias la='ls -A'
alias l='ls -CF'

# Dirs
alias home='cd'
alias work='cd ~/work'
alias root='sudo -i'

# VSCode
alias code='code --no-sandbox --disable-gpu-sandbox'

# apt helpers
alias install='sudo apt-get install'
alias remove='sudo apt-get remove'
alias purge='sudo apt-get remove --purge'
alias update='sudo apt-get update'
alias clean='sudo apt-get autoclean && sudo apt-get autoremove -y'

# chmod quickies (unusual but you asked for them)
alias mx='chmod a+x'
alias 000='chmod 000'
alias 644='chmod 644'
alias 755='chmod 755'

# misc
alias a='alias'
alias c='clear'
alias h='htop'
alias x='exit'
alias font='fc-cache -v -f'
alias cal='cal -m -3'

# Git quality-of-life
alias git='nice git'
alias gsh='git stash'
alias gst='git status --short --branch'
alias gsu='git submodule update --recursive --merge'
alias gdf='git diff'
alias gdt='git difftool'
alias glo='git log --oneline --graph --decorate'
alias gps='git push'
alias gpl='git pull --rebase --autostash'
alias gco='git checkout'
alias gci='git commit'
alias gad='git add'
alias grm='git rm'
alias gmv='git mv'
alias gtg='git tag'
alias gbr='git branch -vv'

# Networking (Linux-friendly)
if command -v ss >/dev/null; then
  alias n='ss -tupan'                      # TCP/UDP + PIDs
else
  alias n='netstat -tupan'                 # fallback if ss is missing
fi
alias mtr='mtr -t'
alias nmap='nmap -vv -T4'
alias nmapp='nmap -Pn -A --osscan-limit'   # -P0 -> deprecated; use -Pn
alias pktstat='sudo pktstat -tBFT'

##############
# extract () #
##############
extract() {
  # usage: extract "file.ext"
  local f=$1
  if [[ -z "$f" ]]; then
    echo "usage: extract <archive>" >&2; return 2
  fi
  if [[ ! -f "$f" ]]; then
    echo "'$f' is not a valid file!" >&2; return 1
  fi
  case "${f,,}" in
    *.tar.bz2|*.tbz|*.tbz2)   tar xvjf -- "$f" ;;
    *.tar.gz|*.tgz)           tar xvzf -- "$f" ;;
    *.tar.xz|*.txz)           tar xvJf -- "$f" ;;
    *.tar.zst|*.tzst)         command -v unzstd >/dev/null && unzstd -c -- "$f" | tar xv || { echo "need zstd"; return 1; } ;;
    *.tar)                    tar xvf -- "$f" ;;
    *.bz2)                    bunzip2 -- "$f" ;;
    *.gz)                     gunzip -- "$f" ;;
    *.xz)                     unxz -- "$f" ;;
    *.zip)                    unzip -- "$f" ;;
    *.7z)                     7z x -- "$f" ;;
    *.rar)                    { command -v unrar >/dev/null && unrar x -- "$f"; } || { command -v 7z >/dev/null && 7z x -- "$f"; } || { echo "need unrar/7z"; return 1; } ;;
    *.Z)                      uncompress -- "$f" ;;
    *)                        echo "don't know how to extract '$f'..." ;;
  esac
}

# Keep PS1 from being overwritten below this line.
